<!-- Pagina dettaglio: recupera una specie con Axios, gestisce il preferito, salva eventuali dati dell'avvistamento e usa supporto ARIA -->
<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../firebase'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { getSpeciesDetail } from '../services/gbifService'
import AppNavbar from '../components/AppNavbar.vue'

const route = useRoute()
const router = useRouter()

const username = localStorage.getItem('bioquestUser')
const speciesId = route.params.id

const species = ref(null)
const isFavorite = ref(false)
const selectedObservation = ref(null)
const observationImageUrl = ref('')
const message = ref('')

async function loadSpeciesDetail() {
  try {
    const data = await getSpeciesDetail(speciesId)

    species.value = data
  } catch (error) {
    message.value = 'Errore durante il caricamento della specie.'
  }
}

async function checkFavorite() {
  if (!username) return

  const favoriteRef = doc(db, 'users', username, 'favorites', speciesId)
  const favoriteSnap = await getDoc(favoriteRef)

  isFavorite.value = favoriteSnap.exists()
}

async function toggleFavorite() {
  if (!username || !species.value) return

  const favoriteRef = doc(db, 'users', username, 'favorites', speciesId)

  if (isFavorite.value) {
    await deleteDoc(favoriteRef)
    isFavorite.value = false
    return
  }

  const favoriteData = {
    scientificName: species.value.scientificName,
    kingdom: species.value.kingdom || '',
    family: species.value.family || '',
    rank: species.value.rank || '',
    savedAt: new Date().toISOString()
  }

  if (selectedObservation.value) {
    favoriteData.observationImageUrl = observationImageUrl.value || ''
    favoriteData.observationCountry = selectedObservation.value.country || ''
    favoriteData.observationDate = selectedObservation.value.eventDate || ''
    favoriteData.observationLocality = selectedObservation.value.locality || ''
    favoriteData.observationLatitude = selectedObservation.value.decimalLatitude || ''
    favoriteData.observationLongitude = selectedObservation.value.decimalLongitude || ''
  }

  await setDoc(favoriteRef, favoriteData)

  isFavorite.value = true
}

function getObservationImage(observation) {
  if (!observation) return ''

  if (observation.media && observation.media.length > 0) {
    const image = observation.media.find(media =>
      media.identifier &&
      (
        media.type === 'StillImage' ||
        media.format?.includes('image') ||
        media.identifier.includes('http')
      )
    )

    if (image) return image.identifier
  }

  if (observation.multimedia && observation.multimedia.length > 0) {
    const image = observation.multimedia.find(media =>
      media.identifier ||
      media.url
    )

    if (image) return image.identifier || image.url
  }

  return ''
}

function loadSelectedObservation() {
  const savedObservation = sessionStorage.getItem('bioquestSelectedObservation')

  if (!savedObservation) return

  const parsedObservation = JSON.parse(savedObservation)

  if (String(parsedObservation.speciesKey) !== String(speciesId)) return

  selectedObservation.value = parsedObservation
  observationImageUrl.value = getObservationImage(parsedObservation)
}

onMounted(async () => {
  await loadSpeciesDetail()
  checkFavorite()
  loadSelectedObservation()
})
</script>

<template>
  <main>
    <AppNavbar />

    <section
      class="container py-4"
      :aria-labelledby="species ? 'species-title' : undefined"
    >
      <button
        class="btn btn-outline-secondary mb-4"
        type="button"
        aria-label="Torna alla pagina precedente"
        @click="router.back()"
      >
        <i
          class="bi bi-arrow-left me-1"
          aria-hidden="true"
        ></i>
        Torna indietro
      </button>

      <div
        v-if="message"
        class="alert alert-danger"
        role="alert"
        aria-live="assertive"
      >
        {{ message }}
      </div>

      <div
        v-if="!species && !message"
        class="alert alert-info"
        role="status"
        aria-live="polite"
      >
        Caricamento...
      </div>

      <div
        v-else-if="species"
        class="card species-detail-card shadow-sm"
        :aria-label="`Dettaglio della specie ${species.scientificName}`"
      >
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-4">
            <div>
              <p class="detail-kicker mb-2">
                <i
                  class="bi bi-tree-fill me-2"
                  aria-hidden="true"
                ></i>
                Scheda tassonomica
              </p>

              <h1
                id="species-title"
                class="card-title fw-bold mb-2"
              >
                {{ species.scientificName }}
              </h1>

              <span class="rank-badge">
                {{ species.rank || 'Classificazione non disponibile' }}
              </span>
            </div>

            <button
              class="btn"
              type="button"
              :class="isFavorite ? 'btn-warning' : 'btn-outline-warning'"
              :aria-label="isFavorite ? 'Rimuovi questa specie dai preferiti' : 'Aggiungi questa specie ai preferiti'"
              @click="toggleFavorite"
            >
              <i
                v-if="isFavorite"
                class="bi bi-star-fill me-1"
                aria-hidden="true"
              ></i>

              <i
                v-else
                class="bi bi-star me-1"
                aria-hidden="true"
              ></i>

              <span class="d-none d-md-inline">
                {{ isFavorite ? 'Rimuovi' : 'Aggiungi' }}
              </span>
            </button>
          </div>

          <div
            v-if="selectedObservation"
            class="observation-box mb-4"
            aria-labelledby="selected-observation-title"
          >
            <div class="row g-3 align-items-center">
              <div
                v-if="observationImageUrl"
                class="col-12 col-md-4"
              >
                <img
                  :src="observationImageUrl"
                  :alt="`Immagine dell'avvistamento di ${species.scientificName}`"
                  class="observation-image"
                />
              </div>

              <div :class="observationImageUrl ? 'col-12 col-md-8' : 'col-12'">
                <p
                  id="selected-observation-title"
                  class="detail-kicker mb-2"
                >
                  <i
                    class="bi bi-geo-alt-fill me-2"
                    aria-hidden="true"
                  ></i>
                  Avvistamento selezionato
                </p>

                <p class="mb-1">
                  <strong>Paese:</strong>
                  {{ selectedObservation.country || 'Non disponibile' }}
                </p>

                <p class="mb-1">
                  <strong>Data:</strong>
                  {{ selectedObservation.eventDate || 'Non disponibile' }}
                </p>

                <p class="mb-1">
                  <strong>Località:</strong>
                  {{ selectedObservation.locality || 'Non disponibile' }}
                </p>

                <p class="mb-0">
                  <strong>Coordinate:</strong>
                  {{ selectedObservation.decimalLatitude || 'N/D' }},
                  {{ selectedObservation.decimalLongitude || 'N/D' }}
                </p>
              </div>
            </div>
          </div>

          <div
            class="row g-3"
            aria-label="Classificazione tassonomica della specie"
          >
            <div class="col-12 col-md-6 col-lg-4">
              <div class="detail-box">
                <span>Regno</span>
                <strong>{{ species.kingdom || 'Non disponibile' }}</strong>
              </div>
            </div>

            <div class="col-12 col-md-6 col-lg-4">
              <div class="detail-box">
                <span>Phylum</span>
                <strong>{{ species.phylum || 'Non disponibile' }}</strong>
              </div>
            </div>

            <div class="col-12 col-md-6 col-lg-4">
              <div class="detail-box">
                <span>Classe</span>
                <strong>{{ species.class || 'Non disponibile' }}</strong>
              </div>
            </div>

            <div class="col-12 col-md-6 col-lg-4">
              <div class="detail-box">
                <span>Ordine</span>
                <strong>{{ species.order || 'Non disponibile' }}</strong>
              </div>
            </div>

            <div class="col-12 col-md-6 col-lg-4">
              <div class="detail-box">
                <span>Famiglia</span>
                <strong>{{ species.family || 'Non disponibile' }}</strong>
              </div>
            </div>

            <div class="col-12 col-md-6 col-lg-4">
              <div class="detail-box">
                <span>Genere</span>
                <strong>{{ species.genus || 'Non disponibile' }}</strong>
              </div>
            </div>

            <div class="col-12 col-md-6 col-lg-4">
              <div class="detail-box">
                <span>Tipo</span>
                <strong>{{ species.rank || 'Non disponibile' }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.species-detail-card {
  border: 1px solid #d8f3dc;
  border-radius: 1rem;
}

.detail-kicker {
  color: #2d6a4f;
  font-weight: 700;
}

.rank-badge {
  display: inline-block;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  color: #2d6a4f;
  background-color: #d8f3dc;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
}

.observation-box {
  padding: 1rem;
  border: 1px solid #d8f3dc;
  border-radius: 0.75rem;
  background-color: #f8fff8;
}

.observation-image {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 0.75rem;
}

.detail-box {
  height: 100%;
  padding: 1rem;
  border: 1px solid #d8f3dc;
  border-radius: 0.75rem;
  background-color: #f8fff8;
}

.detail-box span {
  display: block;
  margin-bottom: 0.25rem;
  color: #6c757d;
  font-size: 0.9rem;
}

.detail-box strong {
  display: block;
  color: #1b4332;
}
</style>
