<!-- Mappa: cerca osservazioni GBIF, mostra marker interattivi e pannello laterale avvistamenti -->
<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
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
const selectedObservation = ref(null)
const message = ref('')
const isSearching = ref(false)
const isLocating = ref(false)
const userPosition = ref(null)
const observationItemRefs = ref({})

let map = null
let markersLayer = null

function getObservationName(observation) {
  return (
    observation.vernacularName ||
    observation.species ||
    observation.scientificName ||
    'Specie non disponibile'
  )
}

function getObservationImage(observation) {
  if (!observation.media || observation.media.length === 0) return ''

  const image = observation.media.find(mediaItem => mediaItem.identifier)

  return image ? image.identifier : ''
}

function getObservationDate(observation) {
  if (!observation.eventDate) return 'Data non disponibile'

  const date = new Date(observation.eventDate)

  if (Number.isNaN(date.getTime())) {
    return 'Data non disponibile'
  }

  return date.toLocaleDateString('it-IT')
}

function formatCoordinate(value) {
  if (value === undefined || value === null) return 'N/D'

  return Number(value).toFixed(4)
}

function getObservationId(observation) {
  return String(
    observation.gbifID ||
    observation.key ||
    observation.occurrenceID ||
    `${observation.decimalLatitude}-${observation.decimalLongitude}-${observation.eventDate}`
  )
}

function setObservationItemRef(observation, element) {
  if (!element) return

  observationItemRefs.value[getObservationId(observation)] = element
}

async function scrollSelectedObservationIntoView(observation) {
  await nextTick()

  const observationId = getObservationId(observation)
  const element = observationItemRefs.value[observationId]

  if (!element) return

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  })
}

function saveMapState() {
  if (!map) return

  const center = map.getCenter()

  sessionStorage.setItem('bioquestMapState', JSON.stringify({
    searchTerm: searchTerm.value,
    observations: observations.value,
    nearbySpecies: nearbySpecies.value,
    selectedObservation: selectedObservation.value,
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

  try {
    const parsedState = JSON.parse(savedState)

    searchTerm.value = parsedState.searchTerm || ''
    observations.value = parsedState.observations || []
    nearbySpecies.value = parsedState.nearbySpecies || []
    selectedObservation.value = parsedState.selectedObservation || null
    message.value = parsedState.message || ''
    userPosition.value = parsedState.userPosition || null

    if (parsedState.center && parsedState.zoom) {
      map.setView(
        [parsedState.center.lat, parsedState.center.lng],
        parsedState.zoom
      )
    }

    renderMarkers()
  } catch (error) {
    sessionStorage.removeItem('bioquestMapState')
  }
}

function createObservationPopup(observation) {
  const name = getObservationName(observation)
  const imageUrl = getObservationImage(observation)

  return `
    <div class="map-popup">
      ${
        imageUrl
          ? `<img src="${imageUrl}" alt="" class="map-popup-image">`
          : ''
      }

      <strong>${name}</strong><br>

      <span>
        ${observation.country || 'Paese non disponibile'}
      </span><br>

      <span>
        ${getObservationDate(observation)}
      </span><br>

      <small>
        Lat: ${formatCoordinate(observation.decimalLatitude)} ·
        Lon: ${formatCoordinate(observation.decimalLongitude)}
      </small>
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

async function selectObservation(observation) {
  selectedObservation.value = observation

  if (
    map &&
    observation.decimalLatitude &&
    observation.decimalLongitude
  ) {
    map.setView(
      [
        observation.decimalLatitude,
        observation.decimalLongitude
      ],
      Math.max(map.getZoom(), 6)
    )
  }

  await scrollSelectedObservationIntoView(observation)

  saveMapState()
}

function openObservationDetail(observation) {
  if (!observation.speciesKey) {
    message.value = 'Dettaglio specie non disponibile per questo avvistamento.'
    saveMapState()
    return
  }

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

function renderMarkers() {
  if (!markersLayer) return

  markersLayer.clearLayers()

  if (userPosition.value) {
    L.marker(
      [userPosition.value.lat, userPosition.value.lon],
      {
        icon: createUserIcon(),
        keyboard: false,
        title: 'La tua posizione',
        alt: 'Marker della tua posizione'
      }
    )
      .addTo(markersLayer)
      .bindPopup('La tua posizione')
  }

  observations.value.forEach(observation => {
    if (!observation.decimalLatitude || !observation.decimalLongitude) return

    const marker = L.marker(
      [
        observation.decimalLatitude,
        observation.decimalLongitude
      ],
      {
        keyboard: false,
        title: getObservationName(observation),
        alt: `Marker dell'avvistamento di ${getObservationName(observation)}`
      }
    )
      .addTo(markersLayer)
      .bindPopup(createObservationPopup(observation))

    marker.on('click', () => {
      selectObservation(observation)
    })
  })
}

function resetMapAfterLogout() {
  searchTerm.value = ''
  observations.value = []
  nearbySpecies.value = []
  selectedObservation.value = null
  message.value = ''
  isSearching.value = false
  isLocating.value = false
  userPosition.value = null
  observationItemRefs.value = {}

  sessionStorage.removeItem('bioquestMapState')
  sessionStorage.removeItem('bioquestSelectedObservation')

  if (markersLayer) {
    markersLayer.clearLayers()
  }

  if (map) {
    map.setView([46.07, 11.12], 5)
  }
}

async function searchOccurrences() {
  const cleanSearch = searchTerm.value.trim()

  if (!cleanSearch) {
    message.value = 'Inserisci una specie da cercare.'
    saveMapState()
    return
  }

  isSearching.value = true
  message.value = 'Ricerca osservazioni in corso...'
  observations.value = []
  nearbySpecies.value = []
  selectedObservation.value = null
  userPosition.value = null
  observationItemRefs.value = {}

  if (markersLayer) {
    markersLayer.clearLayers()
  }

  try {
    const matchData = await matchSpeciesName(cleanSearch)

    if (!matchData.usageKey) {
      message.value = 'Specie non trovata. Prova con un nome scientifico, ad esempio Canis lupus.'
      saveMapState()
      return
    }

    const occurrenceData = await searchOccurrencesByTaxonKey(matchData.usageKey)

    observations.value = occurrenceData.results || []

    buildSpeciesList()
    renderMarkers()

    if (observations.value.length === 0) {
      message.value = 'Nessuna osservazione trovata.'
      saveMapState()
      return
    }

    selectedObservation.value = observations.value[0]
    message.value = `${observations.value.length} osservazioni trovate.`

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

    await scrollSelectedObservationIntoView(firstObservation)

    saveMapState()
  } catch (error) {
    observations.value = []
    nearbySpecies.value = []
    selectedObservation.value = null
    message.value = 'Errore durante la ricerca delle osservazioni. Riprova tra qualche secondo.'
    saveMapState()
  } finally {
    isSearching.value = false
  }
}

async function findNearbySpecies() {
  if (!navigator.geolocation) {
    message.value = 'Geolocalizzazione non supportata dal browser.'
    saveMapState()
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

        observationItemRefs.value = {}

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

        selectedObservation.value = observations.value[0] || null

        map.setView([lat, lon], 10)

        message.value =
          `${observations.value.length} osservazioni trovate vicino a te.`

        if (selectedObservation.value) {
          await scrollSelectedObservationIntoView(selectedObservation.value)
        }

        saveMapState()
      } catch (error) {
        observations.value = []
        nearbySpecies.value = []
        selectedObservation.value = null
        message.value = 'Errore durante la ricerca vicino alla tua posizione.'
        saveMapState()
      } finally {
        isLocating.value = false
      }
    },

    () => {
      message.value = 'Impossibile ottenere la posizione. Controlla i permessi del browser.'
      isLocating.value = false
      saveMapState()
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  )
}

onMounted(() => {
  map = L.map('map', {
    scrollWheelZoom: false,
    keyboard: false
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
  window.addEventListener('bioquest-user-reset', resetMapAfterLogout)
})

onBeforeUnmount(() => {
  window.removeEventListener('bioquest-user-reset', resetMapAfterLogout)

  if (map) {
    map.remove()
    map = null
    markersLayer = null
  }
})
</script>

<template>
  <main>
    <AppNavbar />

    <section
      class="container-fluid map-page"
      aria-labelledby="map-title"
    >
      <div class="row g-4">
        <div class="col-12 col-xl-8">
          <div class="map-header mb-4">
            <h1
              id="map-title"
              class="fw-bold"
            >
              Mappa osservazioni
            </h1>

            <p class="text-muted mb-0">
              Cerca una specie e visualizza osservazioni reali registrate da GBIF.
            </p>
          </div>

          <div
            class="map-search-block mb-3"
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
                :disabled="isSearching"
                @keyup.enter="searchOccurrences"
              />

              <button
                class="btn btn-success"
                type="button"
                :disabled="isSearching"
                aria-label="Cerca osservazioni della specie sulla mappa"
                @click="searchOccurrences"
              >
                <span
                  v-if="isSearching"
                  class="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                ></span>

                <i
                  v-else
                  class="bi bi-search me-1"
                  aria-hidden="true"
                ></i>

                {{ isSearching ? 'Ricerca...' : 'Cerca' }}
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
              :disabled="isLocating || isSearching"
              aria-label="Cerca specie osservate vicino alla tua posizione"
              @click="findNearbySpecies"
            >
              <span
                v-if="isLocating"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>

              <i
                v-else
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
        </div>
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

      <div class="row g-4 align-items-stretch">
        <div class="col-12 col-xl-8">
          <div class="map-shell">
            <div
              id="map"
              class="rounded"
              role="region"
              aria-label="Mappa interattiva con osservazioni geografiche delle specie. Gli avvistamenti sono disponibili nel pannello Avvistamenti."
            ></div>
          </div>
        </div>

        <aside
          class="col-12 col-xl-4"
          aria-labelledby="observations-panel-title"
        >
          <div class="observations-panel">
            <h2
              id="observations-panel-title"
              class="h4 fw-bold mb-3"
            >
              Avvistamenti
            </h2>

            <div
              v-if="!observations.length"
              class="empty-panel"
              role="status"
              aria-live="polite"
            >
              <i
                class="bi bi-geo-alt"
                aria-hidden="true"
              ></i>

              <p class="mb-0">
                Cerca una specie per visualizzare gli avvistamenti disponibili.
              </p>
            </div>

            <div
              v-else
              class="observations-list"
              aria-label="Elenco degli avvistamenti visualizzati sulla mappa"
            >
              <article
                v-for="observation in observations"
                :key="getObservationId(observation)"
                :ref="element => setObservationItemRef(observation, element)"
                class="observation-list-item"
                :class="{
                  active: selectedObservation &&
                    getObservationId(selectedObservation) === getObservationId(observation)
                }"
              >
                <button
                  class="observation-select-button"
                  type="button"
                  :aria-label="`Seleziona avvistamento di ${getObservationName(observation)}`"
                  :aria-pressed="selectedObservation &&
                    getObservationId(selectedObservation) === getObservationId(observation)"
                  @click="selectObservation(observation)"
                >
                  <span class="observation-list-text">
                    <strong>
                      {{ getObservationName(observation) }}
                    </strong>

                    <small>
                      {{ observation.country || 'Paese non disponibile' }}
                      ·
                      {{ getObservationDate(observation) }}
                    </small>

                    <small>
                      Lat: {{ formatCoordinate(observation.decimalLatitude) }},
                      Lon: {{ formatCoordinate(observation.decimalLongitude) }}
                    </small>
                  </span>
                </button>

                <button
                  class="btn btn-sm btn-outline-success mt-2"
                  type="button"
                  :disabled="!observation.speciesKey"
                  :aria-label="`Apri il dettaglio di ${getObservationName(observation)}`"
                  @click="openObservationDetail(observation)"
                >
                  Dettagli
                </button>
              </article>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </main>
</template>

<style scoped>
.map-page {
  padding: 1.5rem;
  color: var(--bioquest-text, #1b4332);
}

.map-header {
  max-width: 900px;
}

.map-shell {
  height: 72vh;
  overflow: hidden;
  border: 1px solid var(--bioquest-border, #d8f3dc);
  border-radius: 0.9rem;
  background-color: var(--bioquest-surface, #ffffff);
  box-shadow: 0 0.35rem 1rem rgba(0, 0, 0, 0.06);
}

#map {
  width: 100%;
  height: 100%;
}

.map-stat-card {
  padding: 1rem;
  border: 1px solid var(--bioquest-border, #d8f3dc);
  border-radius: 0.85rem;
  background-color: var(--bioquest-surface, #ffffff);
}

.map-stat-card span {
  display: block;
  color: var(--bioquest-muted, #6c757d);
  font-size: 0.9rem;
}

.map-stat-card strong {
  display: block;
  color: var(--bioquest-heading, #1b4332);
  font-size: 1.5rem;
}

.search-help {
  color: var(--bioquest-muted, #52796f);
}

.search-help strong {
  color: var(--bioquest-heading, #1b4332);
}

.observations-panel {
  display: flex;
  height: 72vh;
  flex-direction: column;
  overflow: hidden;
  padding: 1rem;
  border: 1px solid var(--bioquest-border, #d8f3dc);
  border-radius: 0.9rem;
  color: var(--bioquest-text, #1b4332);
  background-color: var(--bioquest-surface, #ffffff);
  box-shadow: 0 0.35rem 1rem rgba(0, 0, 0, 0.06);
}

.empty-panel {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 110px;
  padding: 1rem;
  border: 1px dashed var(--bioquest-border-strong, #b7e4c7);
  border-radius: 0.75rem;
  color: var(--bioquest-muted, #52796f);
  background-color: var(--bioquest-surface-soft, #f8fff8);
}

.empty-panel i {
  color: var(--bioquest-primary-medium, #40916c);
  font-size: 1.5rem;
}

.observations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.observation-list-item {
  display: block;
  width: 100%;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--bioquest-border, #d8f3dc);
  border-radius: 0.75rem;
  color: var(--bioquest-text, #1b4332);
  background-color: var(--bioquest-surface, #ffffff);
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.observation-list-item:hover {
  border-color: var(--bioquest-primary-medium, #40916c);
  background-color: var(--bioquest-surface-soft, #f8fff8);
}

.observation-list-item.active {
  border-color: var(--bioquest-primary, #00bd7e);
  background-color: var(--bioquest-primary-soft, rgba(0, 189, 126, 0.12));
  box-shadow: inset 4px 0 0 var(--bioquest-primary, #00bd7e);
}

.observation-list-item.active strong {
  color: var(--bioquest-primary-dark, #008f5f);
}

.observation-select-button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  text-align: left;
}

.observation-select-button:focus-visible {
  outline: 3px solid rgba(0, 189, 126, 0.35);
  outline-offset: 3px;
  border-radius: 0.5rem;
}

.observation-list-text {
  min-width: 0;
}

.observation-list-text strong,
.observation-list-text small {
  display: block;
}

.observation-list-text strong {
  color: var(--bioquest-heading, #1b4332);
  font-size: 0.95rem;
}

.observation-list-text small {
  color: var(--bioquest-muted, #6c757d);
  font-size: 0.8rem;
}

:deep(.map-popup) {
  max-width: 220px;
}

:deep(.map-popup-image) {
  width: 100%;
  height: 110px;
  margin-bottom: 0.5rem;
  border-radius: 0.5rem;
  object-fit: cover;
}

:deep(.user-position-marker) {
  color: #dc3545;
  font-size: 2rem;
}

:global(html[data-theme='dark']) .map-shell,
:global(html[data-theme='dark']) .observations-panel,
:global(html[data-theme='dark']) .map-stat-card,
:global(html[data-theme='dark']) .observation-list-item {
  box-shadow: 0 0.75rem 1.4rem rgba(0, 0, 0, 0.28);
}

:global(html[data-theme='dark']) .leaflet-container {
  background-color: #101513;
}

:global(html[data-theme='dark']) .leaflet-popup-content-wrapper,
:global(html[data-theme='dark']) .leaflet-popup-tip {
  color: var(--bioquest-text, #e8f5ef);
  background-color: var(--bioquest-surface, #18211e);
}

:global(html[data-theme='dark']) .leaflet-control-zoom a,
:global(html[data-theme='dark']) .leaflet-control-attribution {
  color: var(--bioquest-text, #e8f5ef);
  background-color: var(--bioquest-surface, #18211e);
}

:global(html[data-theme='dark']) .leaflet-control-zoom a {
  border-color: var(--bioquest-border, rgba(0, 189, 126, 0.24));
}

@media (max-width: 1199px) {
  .map-shell,
  .observations-panel {
    height: auto;
    min-height: 420px;
  }

  .observations-panel {
    max-height: none;
  }
}

@media (max-width: 575px) {
  .map-page {
    padding: 1rem;
  }

  .input-group {
    flex-direction: column;
  }

  .input-group .form-control,
  .input-group .btn {
    width: 100%;
    border-radius: 0.75rem !important;
  }

  .input-group .btn {
    margin-top: 0.5rem;
  }
}
</style>