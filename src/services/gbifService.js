// Servizio centralizzato per gestire tutte le chiamate API a GBIF con Axios
import axios from 'axios'

const gbifApi = axios.create({
  baseURL: 'https://api.gbif.org/v1'
})

export async function searchSpeciesByName(searchTerm) {
  const response = await gbifApi.get('/species/search', {
    params: {
      q: searchTerm
    }
  })

  return response.data
}

export async function getSpeciesDetail(speciesId) {
  const response = await gbifApi.get(`/species/${speciesId}`)

  return response.data
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