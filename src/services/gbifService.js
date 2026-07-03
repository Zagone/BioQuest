// Servizio centralizzato per gestire tutte le chiamate API a GBIF e Wikipedia con Axios
import axios from 'axios'

const gbifApi = axios.create({
  baseURL: 'https://api.gbif.org/v1'
})

const wikipediaRestApi = axios.create({
  baseURL: 'https://it.wikipedia.org/api/rest_v1'
})

const wikipediaSearchApi = axios.create({
  baseURL: 'https://it.wikipedia.org/w/api.php'
})

const wikipediaEnglishRestApi = axios.create({
  baseURL: 'https://en.wikipedia.org/api/rest_v1'
})

const wikipediaEnglishSearchApi = axios.create({
  baseURL: 'https://en.wikipedia.org/w/api.php'
})

const SEARCH_LIMIT = 80
const DISPLAY_LIMIT = 20
const WIKIPEDIA_CHECK_LIMIT = 12
const WIKIPEDIA_SEARCH_LIMIT = 1

const ALLOWED_KINGDOMS = ['Animalia', 'Metazoa']

const wikipediaSummaryCache = new Map()

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function normalizeScientificName(value) {
  return normalizeText(value)
    .replace(/\s+/g, ' ')
}

function getResultNameKey(speciesItem) {
  return normalizeScientificName(
    speciesItem.canonicalName ||
    speciesItem.scientificName ||
    speciesItem.species ||
    speciesItem.name ||
    speciesItem.key
  )
}

function getTaxonomyScore(speciesItem) {
  let score = 0

  // Valuta quanto è completa la classificazione tassonomica.
  if (speciesItem.kingdom) score += 2
  if (speciesItem.phylum) score += 2
  if (speciesItem.class) score += 2
  if (speciesItem.order) score += 2
  if (speciesItem.family) score += 2
  if (speciesItem.genus) score += 2

  if (speciesItem.rank === 'SPECIES') score += 4
  if (speciesItem.taxonomicStatus === 'ACCEPTED') score += 4
  if (speciesItem.status === 'ACCEPTED') score += 4

  if (speciesItem.canonicalName) score += 1
  if (speciesItem.scientificName) score += 1

  return score
}

function getSearchRelevanceScore(speciesItem, searchTerm) {
  const cleanSearch = normalizeScientificName(searchTerm)
  const scientificName = normalizeScientificName(speciesItem.scientificName)
  const canonicalName = normalizeScientificName(speciesItem.canonicalName)
  const genus = normalizeScientificName(speciesItem.genus)

  let score = 0

  // Premia i risultati più vicini alla ricerca scritta dall'utente.
  if (scientificName === cleanSearch) score += 40
  if (canonicalName === cleanSearch) score += 40

  if (scientificName.startsWith(`${cleanSearch} `)) score += 30
  if (canonicalName.startsWith(`${cleanSearch} `)) score += 30

  if (genus === cleanSearch) score += 28

  if (scientificName.includes(cleanSearch)) score += 8
  if (canonicalName.includes(cleanSearch)) score += 8

  return score
}

function getContentScore(speciesItem) {
  let score = 0

  // Valuta se il risultato sembra avere contenuti enciclopedici utili.
  if (speciesItem.bioquestHasDescription) score += 20
  if (speciesItem.bioquestHasImage) score += 20
  if (speciesItem.bioquestWikipediaUrl) score += 5

  return score
}

function getTotalScore(speciesItem, searchTerm) {
  return (
    getSearchRelevanceScore(speciesItem, searchTerm) +
    getContentScore(speciesItem) +
    getTaxonomyScore(speciesItem)
  )
}

function isAnimalKingdom(speciesItem) {
  if (!speciesItem.kingdom) return false

  return ALLOWED_KINGDOMS.includes(speciesItem.kingdom)
}

function hasTechnicalOrUnclearName(speciesItem) {
  const scientificName = normalizeScientificName(speciesItem.scientificName)
  const canonicalName = normalizeScientificName(speciesItem.canonicalName)
  const combinedName = `${scientificName} ${canonicalName}`

  if (combinedName.includes(' virus')) return true
  if (combinedName.includes('virus ')) return true
  if (combinedName.includes(' viroid')) return true
  if (combinedName.includes('phage')) return true

  if (combinedName.includes(' spec.')) return true
  if (combinedName.includes(' sp.')) return true
  if (combinedName.endsWith(' spec')) return true
  if (combinedName.endsWith(' sp')) return true

  if (combinedName.includes(' x ')) return true
  if (combinedName.includes(' × ')) return true

  return false
}

function isUsefulSpeciesResult(speciesItem) {
  if (!speciesItem) return false
  if (!speciesItem.key) return false
  if (!speciesItem.scientificName && !speciesItem.canonicalName) return false

  if (speciesItem.rank !== 'SPECIES') return false

  if (
    speciesItem.taxonomicStatus &&
    speciesItem.taxonomicStatus !== 'ACCEPTED'
  ) {
    return false
  }

  if (
    speciesItem.status &&
    speciesItem.status !== 'ACCEPTED'
  ) {
    return false
  }

  if (!isAnimalKingdom(speciesItem)) return false
  if (hasTechnicalOrUnclearName(speciesItem)) return false

  return true
}

function removeDuplicateSpecies(results, searchTerm) {
  const bestResultsByName = new Map()

  results.forEach((speciesItem) => {
    if (!isUsefulSpeciesResult(speciesItem)) return

    const nameKey = getResultNameKey(speciesItem)

    if (!nameKey) return

    const currentBest = bestResultsByName.get(nameKey)

    if (!currentBest) {
      bestResultsByName.set(nameKey, speciesItem)
      return
    }

    if (
      getTotalScore(speciesItem, searchTerm) >
      getTotalScore(currentBest, searchTerm)
    ) {
      bestResultsByName.set(nameKey, speciesItem)
    }
  })

  return Array.from(bestResultsByName.values())
}

function getWikipediaQueries(speciesItem) {
  return [
    speciesItem.vernacularName,
    speciesItem.canonicalName,
    speciesItem.scientificName
  ].filter(Boolean)
}

function getUniqueWikipediaQueries(queries) {
  const uniqueQueries = new Map()

  queries
    .filter(Boolean)
    .forEach(query => {
      const cleanQuery = normalizeScientificName(query)

      if (!cleanQuery) return

      if (!uniqueQueries.has(cleanQuery)) {
        uniqueQueries.set(cleanQuery, query)
      }
    })

  return Array.from(uniqueQueries.values())
}

function getEmptyWikipediaInfo() {
  return {
    hasDescription: false,
    hasImage: false,
    description: '',
    image: '',
    url: '',
    query: '',
    language: ''
  }
}

async function searchWikipediaPageTitle(query, searchApi) {
  const response = await searchApi.get('', {
    params: {
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      origin: '*',
      srlimit: WIKIPEDIA_SEARCH_LIMIT
    }
  })

  const firstResult = response.data?.query?.search?.[0]

  return firstResult?.title || ''
}

async function getWikipediaSummaryByTitle(title, restApi) {
  const response = await restApi.get(
    `/page/summary/${encodeURIComponent(title)}`
  )

  return response.data
}

async function getWikipediaInfoFromLanguage(query, searchApi, restApi, language) {
  const pageTitle = await searchWikipediaPageTitle(query, searchApi)

  if (!pageTitle) {
    return null
  }

  const data = await getWikipediaSummaryByTitle(pageTitle, restApi)

  if (data?.type === 'disambiguation') {
    return null
  }

  const hasDescription = Boolean(data?.extract)
  const hasImage = Boolean(data?.originalimage?.source || data?.thumbnail?.source)

  if (!hasDescription && !hasImage) {
    return null
  }

  return {
    hasDescription,
    hasImage,
    description: data?.extract || '',
    image:
      data?.originalimage?.source ||
      data?.thumbnail?.source ||
      '',
    url: data?.content_urls?.desktop?.page || '',
    query: pageTitle,
    language
  }
}

async function getWikipediaSummaryForQuery(query) {
  const cleanQuery = normalizeScientificName(query)

  if (!cleanQuery) {
    return getEmptyWikipediaInfo()
  }

  if (wikipediaSummaryCache.has(cleanQuery)) {
    return wikipediaSummaryCache.get(cleanQuery)
  }

  try {
    const italianInfo = await getWikipediaInfoFromLanguage(
      query,
      wikipediaSearchApi,
      wikipediaRestApi,
      'it'
    )

    if (italianInfo) {
      wikipediaSummaryCache.set(cleanQuery, italianInfo)
      return italianInfo
    }

    const englishInfo = await getWikipediaInfoFromLanguage(
      query,
      wikipediaEnglishSearchApi,
      wikipediaEnglishRestApi,
      'en'
    )

    if (englishInfo) {
      wikipediaSummaryCache.set(cleanQuery, englishInfo)
      return englishInfo
    }
  } catch (error) {
    // Se Wikipedia non risponde o non trova risultati utili, continuiamo senza bloccare la ricerca.
  }

  const emptyInfo = getEmptyWikipediaInfo()

  wikipediaSummaryCache.set(cleanQuery, emptyInfo)

  return emptyInfo
}

async function getWikipediaSummaryForSpecies(speciesItem) {
  const queries = getWikipediaQueries(speciesItem)

  for (const query of queries) {
    const wikipediaInfo = await getWikipediaSummaryForQuery(query)

    if (wikipediaInfo.hasDescription || wikipediaInfo.hasImage) {
      return wikipediaInfo
    }
  }

  return getEmptyWikipediaInfo()
}

export async function getWikipediaSummaryForQueries(queries) {
  const uniqueQueries = getUniqueWikipediaQueries(queries)

  for (const query of uniqueQueries) {
    const wikipediaInfo = await getWikipediaSummaryForQuery(query)

    if (wikipediaInfo.hasDescription || wikipediaInfo.hasImage) {
      return wikipediaInfo
    }
  }

  return getEmptyWikipediaInfo()
}

async function enrichSpeciesWithWikipediaInfo(results) {
  const candidatesToCheck = results.slice(0, WIKIPEDIA_CHECK_LIMIT)
  const remainingResults = results.slice(WIKIPEDIA_CHECK_LIMIT)

  const enrichedCandidates = await Promise.all(
    candidatesToCheck.map(async (speciesItem) => {
      const wikipediaInfo = await getWikipediaSummaryForSpecies(speciesItem)

      return {
        ...speciesItem,
        bioquestHasDescription: wikipediaInfo.hasDescription,
        bioquestHasImage: wikipediaInfo.hasImage,
        bioquestWikipediaUrl: wikipediaInfo.url,
        bioquestWikipediaQuery: wikipediaInfo.query
      }
    })
  )

  return [
    ...enrichedCandidates,
    ...remainingResults
  ]
}

export async function searchSpeciesByName(searchTerm) {
  const response = await gbifApi.get('/species/search', {
    params: {
      q: searchTerm,
      rank: 'SPECIES',
      status: 'ACCEPTED',
      limit: SEARCH_LIMIT
    }
  })

  const filteredResults = removeDuplicateSpecies(
    response.data.results || [],
    searchTerm
  )

  const sortedByTaxonomyAndRelevance = filteredResults.sort(
    (firstItem, secondItem) => {
      return (
        getTotalScore(secondItem, searchTerm) -
        getTotalScore(firstItem, searchTerm)
      )
    }
  )

  const enrichedResults = await enrichSpeciesWithWikipediaInfo(
    sortedByTaxonomyAndRelevance
  )

  const finalResults = enrichedResults
    .sort((firstItem, secondItem) => {
      return (
        getTotalScore(secondItem, searchTerm) -
        getTotalScore(firstItem, searchTerm)
      )
    })
    .slice(0, DISPLAY_LIMIT)

  return {
    ...response.data,
    results: finalResults
  }
}

export async function getSpeciesDetail(speciesId) {
  const response = await gbifApi.get(`/species/${speciesId}`)
  const speciesDetail = response.data

  const mainSpeciesKey =
    speciesDetail.speciesKey ||
    speciesDetail.acceptedKey ||
    speciesDetail.key

  if (
    mainSpeciesKey &&
    String(mainSpeciesKey) !== String(speciesDetail.key) &&
    speciesDetail.rank !== 'SPECIES'
  ) {
    const mainSpeciesResponse = await gbifApi.get(`/species/${mainSpeciesKey}`)
    return mainSpeciesResponse.data
  }

  return speciesDetail
}

export async function matchSpeciesName(name) {
  const response = await gbifApi.get('/species/match', {
    params: {
      name
    }
  })

  return response.data
}

export async function searchOccurrencesByTaxonKey(taxonKey) {
  const response = await gbifApi.get('/occurrence/search', {
    params: {
      taxonKey,
      hasCoordinate: true,
      limit: 50
    }
  })

  return response.data
}

export async function searchOccurrencesNearby(minLat, maxLat, minLon, maxLon) {
  const response = await gbifApi.get('/occurrence/search', {
    params: {
      hasCoordinate: true,
      limit: 50,
      decimalLatitude: `${minLat},${maxLat}`,
      decimalLongitude: `${minLon},${maxLon}`
    }
  })

  return response.data
}