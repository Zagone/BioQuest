<!-- Mappa: cerca osservazioni GBIF con Axios, usa geolocalizzazione, conserva lo stato e usa supporto ARIA -->
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import {
  matchSpeciesName,
  searchOccurrencesByTaxonKey,
  searchOccurrencesNearby
} from '../services/gbifService'
import AppNavbar from '../components/AppNavbar.vue'
import 'leaflet/dist/leaflet.css'

const router = useRouter()

const searchTerm = ref('')
const observations = ref([])
const nearbySpecies = ref([])
const message = ref('')
const isLocating = ref(false)
const userPosition = ref(null)

let map = null
let markersLayer = null

function saveMapState() {
  if (!map) return

  const center = map.getCenter()

  sessionStorage.setItem('bioquestMapState', JSON.stringify({
    searchTerm: searchTerm.value,
    observations: observations.value,
    nearbySpecies: nearbySpecies.value,
    message: message.value,
    userPosition: userPosition.value,
    center: {
      lat: center.lat,
      lng: center.lng
    },
    zoom: map.getZoom()
  }))
}

function restoreMapState() {
  const savedState = sessionStorage.getItem('bioquestMapState')

  if (!savedState) return

  const parsedState = JSON.parse(savedState)

  searchTerm.value = parsedState.searchTerm || ''
  observations.value = parsedState.observations || []
  nearbySpecies.value = parsedState.nearbySpecies || []
  message.value = parsedState.message || ''
  userPosition.value = parsedState.userPosition || null

  if (parsedState.center && parsedState.zoom) {
    map.setView(
      [parsedState.center.lat, parsedState.center.lng],
      parsedState.zoom
    )
  }

  renderMarkers()
}

function getObservationName(observation) {
  return (
    observation.vernacularName ||
    observation.species ||
    observation.scientificName ||
    'Specie non disponibile'
  )
}

function createObservationPopup(observation) {
  const name = getObservationName(observation)

  return `
    <div class="map-popup">
      <strong>${name}</strong><br>
      ${observation.country || 'Paese non disponibile'}<br>
      ${observation.eventDate || 'Data non disponibile'}
    </div>
  `
}

function createUserIcon() {
  return L.divIcon({
    className: 'user-position-marker',
    html: '<i class="bi bi-geo-alt-fill" aria-hidden="true"></i>',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  })
}

function buildSpeciesList() {
  const uniqueSpecies = new Map()

  observations.value.forEach(observation => {
    const speciesName = getObservationName(observation)

    if (!speciesName) return

    if (!uniqueSpecies.has(speciesName)) {
      uniqueSpecies.set(speciesName, observation)
    }
  })

  nearbySpecies.value = [...uniqueSpecies.values()]
}

function renderMarkers() {
  if (!markersLayer) return

  markersLayer.clearLayers()

  if (userPosition.value) {
    L.marker(
      [userPosition.value.lat, userPosition.value.lon],
      { icon: createUserIcon() }
    )
      .addTo(markersLayer)
      .bindPopup('La tua posizione')
  }

  observations.value.forEach(observation => {
    if (!observation.decimalLatitude || !observation.decimalLongitude) return

    L.marker([
      observation.decimalLatitude,
      observation.decimalLongitude
    ])
      .addTo(markersLayer)
      .bindPopup(createObservationPopup(observation))
  })
}

function openObservationDetail(observation) {
  if (!observation.speciesKey) return

  sessionStorage.setItem(
    'bioquestSelectedObservation',
    JSON.stringify(observation)
  )

  router.push({
    path: `/species/${observation.speciesKey}`,
    query: {
      source: 'map'
    }
  })
}

onMounted(() => {
  map = L.map('map', {
    scrollWheelZoom: false
  }).setView([46.07, 11.12], 5)

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '&copy; OpenStreetMap contributors'
    }
  ).addTo(map)

  map.on('click', () => {
    map.scrollWheelZoom.enable()
  })

  map.on('mouseout', () => {
    map.scrollWheelZoom.disable()
  })

  map.on('moveend zoomend', () => {
    saveMapState()
  })

  markersLayer = L.layerGroup().addTo(map)

  restoreMapState()
})

async function searchOccurrences() {
  const cleanSearch = searchTerm.value.trim()

  if (!cleanSearch) {
    message.value = 'Inserisci una specie da cercare.'
    return
  }

  message.value = 'Ricerca osservazioni in corso...'
  observations.value = []
  nearbySpecies.value = []
  userPosition.value = null

  if (markersLayer) {
    markersLayer.clearLayers()
  }

  try {
    const matchData = await matchSpeciesName(cleanSearch)

    if (!matchData.usageKey) {
      message.value = 'Specie non trovata'
      saveMapState()
      return
    }

    const occurrenceData = await searchOccurrencesByTaxonKey(matchData.usageKey)

    observations.value = occurrenceData.results || []

    buildSpeciesList()
    renderMarkers()

    if (observations.value.length === 0) {
      message.value = 'Nessuna osservazione trovata'
      saveMapState()
      return
    }

    message.value = `${observations.value.length} osservazioni trovate`

    const firstObservation = observations.value[0]

    if (firstObservation.decimalLatitude && firstObservation.decimalLongitude) {
      map.setView(
        [
          firstObservation.decimalLatitude,
          firstObservation.decimalLongitude
        ],
        4
      )
    }

    saveMapState()
  } catch (error) {
    observations.value = []
    nearbySpecies.value = []
    message.value = 'Errore durante la ricerca delle osservazioni. Riprova tra qualche secondo.'
    saveMapState()
  }
}

async function findNearbySpecies() {
  if (!navigator.geolocation) {
    message.value = 'Geolocalizzazione non supportata'
    return
  }

  isLocating.value = true
  message.value = 'Recupero posizione...'

  navigator.geolocation.getCurrentPosition(
    async position => {
      try {
        const lat = position.coords.latitude
        const lon = position.coords.longitude

        const distance = 0.25

        const minLat = lat - distance
        const maxLat = lat + distance
        const minLon = lon - distance
        const maxLon = lon + distance

        userPosition.value = {
          lat,
          lon
        }

        if (markersLayer) {
          markersLayer.clearLayers()
        }

        const data = await searchOccurrencesNearby(
          minLat,
          maxLat,
          minLon,
          maxLon
        )

        observations.value = data.results || []

        buildSpeciesList()
        renderMarkers()

        map.setView([lat, lon], 10)

        message.value =
          `${observations.value.length} osservazioni trovate vicino a te`

        saveMapState()
      } catch (error) {
        observations.value = []
        nearbySpecies.value = []
        message.value = 'Errore durante la ricerca vicino alla tua posizione.'
        saveMapState()
      } finally {
        isLocating.value = false
      }
    },

    () => {
      message.value = 'Impossibile ottenere la posizione'
      isLocating.value = false
      saveMapState()
    }
  )
}
</script>

<template>
  <main>
    <AppNavbar />

    <section
      class="container py-4"
      aria-labelledby="map-title"
    >
      <div class="mb-4">
        <h1
          id="map-title"
          class="fw-bold"
        >
          Mappa osservazioni
        </h1>

        <p class="text-muted">
          Cerca una specie e visualizza osservazioni reali registrate da GBIF.
        </p>
      </div>

      <div
        class="mb-3"
        aria-label="Ricerca osservazioni sulla mappa"
      >
        <label
          for="map-species-search"
          class="form-label visually-hidden"
        >
          Cerca una specie da visualizzare sulla mappa
        </label>

        <div class="input-group">
          <input
            id="map-species-search"
            v-model="searchTerm"
            class="form-control"
            type="text"
            placeholder="Es. Canis lupus"
            aria-describedby="map-search-help"
            @keyup.enter="searchOccurrences"
          />

          <button
            class="btn btn-primary"
            type="button"
            aria-label="Cerca osservazioni della specie sulla mappa"
            @click="searchOccurrences"
          >
            <i
              class="bi bi-search me-1"
              aria-hidden="true"
            ></i>
            Cerca
          </button>
        </div>

        <small
          id="map-search-help"
          class="search-help d-block mt-2"
        >
          Per risultati più precisi usa il nome scientifico, ad esempio
          <strong>Canis lupus</strong>. I nomi comuni possono non essere riconosciuti da GBIF.
        </small>
      </div>

      <div class="mb-3">
        <button
          class="btn btn-success"
          type="button"
          :disabled="isLocating"
          aria-label="Cerca specie osservate vicino alla tua posizione"
          @click="findNearbySpecies"
        >
          <i
            class="bi bi-geo-alt me-1"
            aria-hidden="true"
          ></i>

          {{
            isLocating
              ? 'Localizzazione...'
              : 'Specie vicino a me'
          }}
        </button>
      </div>

      <div
        v-if="message"
        class="alert alert-info"
        role="status"
        aria-live="polite"
      >
        <i
          class="bi bi-info-circle me-1"
          aria-hidden="true"
        ></i>
        {{ message }}
      </div>

      <div
        v-if="observations.length > 0"
        class="row g-3 mb-3"
        aria-label="Statistiche delle osservazioni visualizzate"
      >
        <div class="col-12 col-md-6">
          <div class="map-stat-card">
            <span>Osservazioni visualizzate</span>
            <strong>{{ observations.length }}</strong>
          </div>
        </div>

        <div class="col-12 col-md-6">
          <div class="map-stat-card">
            <span>Specie visualizzate</span>
            <strong>{{ nearbySpecies.length }}</strong>
          </div>
        </div>
      </div>

      <div
        id="map"
        class="rounded shadow-sm"
        role="application"
        aria-label="Mappa interattiva con osservazioni geografiche delle specie"
      ></div>

      <div
        v-if="nearbySpecies.length"
        class="mt-4"
        aria-labelledby="species-list-title"
      >
        <h3 id="species-list-title">
          <i
            class="bi bi-list-ul me-1"
            aria-hidden="true"
          ></i>
          Specie visualizzate
        </h3>

        <div
          class="list-group"
          aria-label="Elenco delle specie visualizzate sulla mappa"
        >
          <button
            v-for="item in nearbySpecies"
            :key="item.key || item.gbifID || item.speciesKey"
            class="list-group-item list-group-item-action"
            type="button"
            :disabled="!item.speciesKey"
            :aria-label="`Apri il dettaglio di ${item.vernacularName || item.species || item.scientificName}`"
            @click="openObservationDetail(item)"
          >
            {{ item.vernacularName || item.species || item.scientificName }}

            <small class="d-block text-muted">
              {{ item.scientificName }}
            </small>
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
#map {
  height: 70vh;
  width: 100%;
}

.map-stat-card {
  padding: 1rem;
  border: 1px solid #d8f3dc;
  border-radius: 0.75rem;
  background-color: #f8fff8;
}

.map-stat-card span {
  display: block;
  color: #6c757d;
  font-size: 0.9rem;
}

.map-stat-card strong {
  display: block;
  color: #1b4332;
  font-size: 1.5rem;
}

.search-help {
  color: #52796f;
}

:deep(.user-position-marker) {
  color: #dc3545;
  font-size: 2rem;
}
</style>