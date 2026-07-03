<!-- Dettaglio specie: foto/descrizione stile Gio, senza IUCN, con fallback Wikipedia IT/EN e toast dinamici -->
<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { db } from '../firebase'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import {
  getSpeciesDetail,
  getWikipediaSummaryForQueries
} from '../services/gbifService'
import AppNavbar from '../components/AppNavbar.vue'
import AppToast from '../components/AppToast.vue'

const route = useRoute()
const router = useRouter()

const username = localStorage.getItem('bioquestUser')
const speciesId = String(route.params.id)

const species = ref(null)
const selectedObservation = ref(null)
const favoriteObservation = ref(null)

const wikipediaDescription = ref('')
const wikipediaImage = ref('')
const wikipediaUrl = ref('')
const wikipediaLanguage = ref('')

const isFavorite = ref(false)
const isLoading = ref(true)
const isSavingNote = ref(false)
const isRemovingFavorite = ref(false)
const removeFavoriteDialogOpen = ref(false)

const message = ref('')
const note = ref('')

const toastMessage = ref('')
const toastType = ref('info')
const toastVisible = ref(false)

const isMapObservationDetail = computed(() => {
  return route.query.source === 'map' && Boolean(selectedObservation.value)
})

const isProfileObservationDetail = computed(() => {
  return route.query.source === 'profile' && Boolean(favoriteObservation.value)
})

const backLinkTarget = computed(() => {
  if (route.query.source === 'profile') {
    return '/profile'
  }

  if (route.query.source === 'map') {
    return '/map'
  }

  return '/home'
})

const backLinkText = computed(() => {
  if (route.query.source === 'profile') {
    return 'Torna al profilo'
  }

  if (route.query.source === 'map') {
    return 'Torna alla mappa'
  }

  return 'Torna alla ricerca'
})

const wikipediaSourceText = computed(() => {
  if (wikipediaLanguage.value === 'en') {
    return 'Fonte descrizione: Wikipedia EN'
  }

  if (wikipediaLanguage.value === 'it') {
    return 'Fonte descrizione: Wikipedia IT'
  }

  return 'Fonte descrizione'
})

function showToast(text, type = 'info') {
  toastVisible.value = false

  setTimeout(() => {
    toastMessage.value = text
    toastType.value = type
    toastVisible.value = true
  }, 20)
}

function closeToast() {
  toastVisible.value = false
}

function getSpeciesName() {
  return (
    species.value?.vernacularName ||
    species.value?.canonicalName ||
    species.value?.scientificName ||
    selectedObservation.value?.species ||
    selectedObservation.value?.scientificName ||
    favoriteObservation.value?.scientificName ||
    'Specie non disponibile'
  )
}

function getScientificName() {
  return (
    species.value?.scientificName ||
    selectedObservation.value?.scientificName ||
    favoriteObservation.value?.scientificName ||
    'Nome scientifico non disponibile'
  )
}

function getWikipediaQueries() {
  if (!species.value) return []

  return [
    species.value.vernacularName,
    species.value.canonicalName,
    species.value.scientificName,
    species.value.species
  ].filter(Boolean)
}

function resetWikipediaInfo() {
  wikipediaDescription.value = 'Nessuna descrizione disponibile.'
  wikipediaImage.value = ''
  wikipediaUrl.value = ''
  wikipediaLanguage.value = ''
}

function getObservationImage(observation) {
  if (!observation?.media || observation.media.length === 0) return ''

  const image = observation.media.find(mediaItem => mediaItem.identifier)

  return image ? image.identifier : ''
}

function getMainImage() {
  if (isMapObservationDetail.value) {
    return getObservationImage(selectedObservation.value)
  }

  if (isProfileObservationDetail.value) {
    return favoriteObservation.value.imageUrl || ''
  }

  return wikipediaImage.value || ''
}

function getDescription() {
  return wikipediaDescription.value || 'Nessuna descrizione disponibile.'
}

function getTaxonomyItems() {
  if (!species.value) return []

  return [
    {
      label: 'Regno',
      value: species.value.kingdom
    },
    {
      label: 'Phylum',
      value: species.value.phylum
    },
    {
      label: 'Classe',
      value: species.value.class
    },
    {
      label: 'Ordine',
      value: species.value.order
    },
    {
      label: 'Famiglia',
      value: species.value.family
    },
    {
      label: 'Genere',
      value: species.value.genus
    },
    {
      label: 'Rango',
      value: species.value.rank
    }
  ].filter(item => item.value)
}

function formatDate(value) {
  if (!value) return 'Data non disponibile'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('it-IT')
}

function formatCoordinate(value) {
  if (value === undefined || value === null || value === '') return 'N/D'

  return Number(value).toFixed(4)
}

function loadSelectedObservation() {
  const savedObservation = sessionStorage.getItem('bioquestSelectedObservation')

  if (!savedObservation) return

  try {
    const parsedObservation = JSON.parse(savedObservation)

    if (String(parsedObservation.speciesKey) === speciesId) {
      selectedObservation.value = parsedObservation
    }
  } catch (error) {
    selectedObservation.value = null
  }
}

async function loadSpeciesDetail() {
  try {
    species.value = await getSpeciesDetail(speciesId)
  } catch (error) {
    message.value = 'Errore durante il caricamento del dettaglio della specie.'
  }
}

async function loadWikipedia() {
  const queries = getWikipediaQueries()

  if (queries.length === 0) {
    resetWikipediaInfo()
    return
  }

  try {
    const wikipediaInfo = await getWikipediaSummaryForQueries(queries)

    if (!wikipediaInfo.hasDescription && !wikipediaInfo.hasImage) {
      resetWikipediaInfo()
      return
    }

    wikipediaDescription.value =
      wikipediaInfo.description || 'Nessuna descrizione disponibile.'

    wikipediaImage.value = wikipediaInfo.image || ''
    wikipediaUrl.value = wikipediaInfo.url || ''
    wikipediaLanguage.value = wikipediaInfo.language || ''
  } catch (error) {
    resetWikipediaInfo()
  }
}

function buildFavoriteObservation(data) {
  if (!data) return null

  const hasObservationData =
    data.observationImageUrl ||
    data.observationCountry ||
    data.observationDate ||
    data.observationLocality ||
    data.observationLatitude ||
    data.observationLongitude

  if (!hasObservationData) return null

  return {
    scientificName: data.scientificName || '',
    imageUrl: data.observationImageUrl || '',
    country: data.observationCountry || '',
    eventDate: data.observationDate || '',
    locality: data.observationLocality || '',
    decimalLatitude: data.observationLatitude || '',
    decimalLongitude: data.observationLongitude || ''
  }
}

async function loadFavoriteState() {
  if (!username) return

  try {
    const favoriteRef = doc(db, 'users', username, 'favorites', speciesId)
    const favoriteSnapshot = await getDoc(favoriteRef)

    isFavorite.value = favoriteSnapshot.exists()

    if (favoriteSnapshot.exists()) {
      favoriteObservation.value = buildFavoriteObservation(favoriteSnapshot.data())
    }
  } catch (error) {
    isFavorite.value = false
    favoriteObservation.value = null
  }
}

function goLogin() {
  router.push({
    path: '/login',
    query: {
      redirect: route.fullPath
    }
  })
}

function closeRemoveFavoriteDialog() {
  if (isRemovingFavorite.value) return
  removeFavoriteDialogOpen.value = false
}

async function confirmRemoveFavoriteFromDetail() {
  if (!username || !species.value) return

  isRemovingFavorite.value = true

  try {
    const favoriteRef = doc(db, 'users', username, 'favorites', speciesId)

    await deleteDoc(favoriteRef)

    isFavorite.value = false
    favoriteObservation.value = null
    removeFavoriteDialogOpen.value = false
    showToast('Specie rimossa dai preferiti.', 'success')
  } catch (error) {
    showToast('Errore durante la rimozione dai preferiti.', 'error')
  } finally {
    isRemovingFavorite.value = false
  }
}

async function toggleFavorite() {
  if (!username || !species.value) return

  if (isFavorite.value) {
    removeFavoriteDialogOpen.value = true
    return
  }

  const favoriteRef = doc(db, 'users', username, 'favorites', speciesId)

  const favoriteData = {
    scientificName: species.value.scientificName || getScientificName(),
    vernacularName: species.value.vernacularName || '',
    canonicalName: species.value.canonicalName || '',
    kingdom: species.value.kingdom || '',
    family: species.value.family || '',
    rank: species.value.rank || '',
    imageUrl: getMainImage() || '',
    savedAt: new Date().toISOString()
  }

  if (isMapObservationDetail.value) {
    favoriteData.observationImageUrl =
      getObservationImage(selectedObservation.value) || ''

    favoriteData.observationCountry =
      selectedObservation.value.country || ''

    favoriteData.observationDate =
      selectedObservation.value.eventDate || ''

    favoriteData.observationLocality =
      selectedObservation.value.locality || ''

    favoriteData.observationLatitude =
      selectedObservation.value.decimalLatitude || ''

    favoriteData.observationLongitude =
      selectedObservation.value.decimalLongitude || ''
  }

  try {
    await setDoc(favoriteRef, favoriteData)

    isFavorite.value = true
    favoriteObservation.value = buildFavoriteObservation(favoriteData)
    showToast('Specie aggiunta ai preferiti.', 'success')
  } catch (error) {
    showToast('Errore durante il salvataggio nei preferiti.', 'error')
  }
}

async function loadPersonalNote() {
  if (!username) return

  try {
    const noteRef = doc(db, 'users', username, 'notes', speciesId)
    const noteSnapshot = await getDoc(noteRef)

    if (noteSnapshot.exists()) {
      note.value = noteSnapshot.data().text || ''
    }
  } catch (error) {
    note.value = ''
  }
}

async function savePersonalNote() {
  if (!username) {
    showToast('Devi essere loggato per salvare una nota.', 'warning')
    return
  }

  isSavingNote.value = true

  try {
    const noteRef = doc(db, 'users', username, 'notes', speciesId)

    await setDoc(noteRef, {
      text: note.value,
      speciesId,
      speciesName: getSpeciesName(),
      updatedAt: new Date().toISOString()
    })

    showToast('Nota salvata correttamente.', 'success')
  } catch (error) {
    showToast('Errore durante il salvataggio della nota.', 'error')
  } finally {
    isSavingNote.value = false
  }
}

onMounted(async () => {
  try {
    loadSelectedObservation()

    await loadSpeciesDetail()

    await Promise.all([
      loadWikipedia(),
      loadFavoriteState(),
      loadPersonalNote()
    ])
  } catch (error) {
    message.value = 'Errore durante il caricamento della pagina dettaglio.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main>
    <AppNavbar />

    <AppToast
      :show="toastVisible"
      :message="toastMessage"
      :type="toastType"
      @close="closeToast"
    />

    <section
      class="species-detail-page"
      aria-labelledby="species-detail-title"
    >
      <div class="container py-4">
        <RouterLink
          :to="backLinkTarget"
          class="back-link"
        >
          <i
            class="bi bi-arrow-left"
            aria-hidden="true"
          ></i>
          {{ backLinkText }}
        </RouterLink>

        <div
          v-if="isLoading"
          class="loading-card"
          role="status"
        >
          <div
            class="spinner-border text-success"
            aria-hidden="true"
          ></div>

          <p class="mb-0 mt-3">
            Caricamento dettaglio specie...
          </p>
        </div>

        <div
          v-else-if="species"
          class="detail-shell"
        >
          <header class="detail-hero">
            <div>
              <p class="section-kicker mb-2">
                Dettaglio specie
              </p>

              <h1
                id="species-detail-title"
                class="detail-title"
              >
                {{ getSpeciesName() }}
              </h1>

              <p class="scientific-name mb-0">
                {{ getScientificName() }}
              </p>
            </div>

            <button
              v-if="username"
              class="favorite-button"
              type="button"
              :class="{ active: isFavorite }"
              :aria-label="isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
              @click="toggleFavorite"
            >
              <i
                :class="isFavorite ? 'bi bi-heart-fill' : 'bi bi-heart'"
                aria-hidden="true"
              ></i>

              <span>
                {{ isFavorite ? 'Nei preferiti' : 'Aggiungi ai preferiti' }}
              </span>
            </button>

            <button
              v-else
              class="login-required-button"
              type="button"
              aria-label="Accedi per aggiungere questa specie ai preferiti"
              @click="goLogin"
            >
              <i
                class="bi bi-lock"
                aria-hidden="true"
              ></i>

              <span>
                Accedi per aggiungere ai preferiti
              </span>
            </button>
          </header>

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

          <section
            class="taxonomy-strip"
            aria-label="Classificazione tassonomica"
          >
            <article
              v-for="item in getTaxonomyItems()"
              :key="item.label"
              class="taxonomy-pill"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </section>

          <section class="row g-4 align-items-stretch">
            <div class="col-12 col-xl-7">
              <article class="image-card">
                <img
                  v-if="getMainImage()"
                  :src="getMainImage()"
                  class="species-image"
                  :alt="`Foto di ${getSpeciesName()}`"
                />

                <div
                  v-else
                  class="species-image-placeholder"
                  aria-hidden="true"
                >
                  <i class="bi bi-image"></i>
                  <span>Immagine non disponibile</span>
                </div>
              </article>
            </div>

            <div class="col-12 col-xl-5">
              <article class="description-card">
                <h2 class="h4 fw-bold mb-3">
                  Descrizione
                </h2>

                <p class="description-text">
                  {{ getDescription() }}
                </p>

                <a
                  v-if="wikipediaUrl"
                  :href="wikipediaUrl"
                  class="source-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ wikipediaSourceText }}
                  <i
                    class="bi bi-box-arrow-up-right ms-1"
                    aria-hidden="true"
                  ></i>
                </a>

                <div
                  v-if="isProfileObservationDetail"
                  class="observation-summary"
                >
                  <h3 class="h6 fw-bold mb-3">
                    Osservazione salvata
                  </h3>

                  <ul>
                    <li>
                      <strong>Paese:</strong>
                      {{ favoriteObservation.country || 'Paese non disponibile' }}
                    </li>

                    <li>
                      <strong>Località:</strong>
                      {{ favoriteObservation.locality || 'Località non disponibile' }}
                    </li>

                    <li>
                      <strong>Data:</strong>
                      {{ formatDate(favoriteObservation.eventDate) }}
                    </li>

                    <li>
                      <strong>Coordinate:</strong>
                      {{ formatCoordinate(favoriteObservation.decimalLatitude) }},
                      {{ formatCoordinate(favoriteObservation.decimalLongitude) }}
                    </li>
                  </ul>
                </div>
              </article>
            </div>
          </section>

          <section class="row g-4">
            <div class="col-12">
              <article
                class="note-card"
                aria-labelledby="note-title"
              >
                <h2
                  id="note-title"
                  class="h5 fw-bold mb-2"
                >
                  Nota personale
                </h2>

                <div v-if="username">
                  <label
                    for="personal-note"
                    class="form-label note-label"
                  >
                    Aggiungi una nota su questa specie
                  </label>

                  <textarea
                    id="personal-note"
                    v-model="note"
                    class="form-control note-textarea"
                    rows="3"
                    placeholder="Scrivi una nota..."
                  ></textarea>

                  <button
                    class="btn btn-sm btn-success mt-2"
                    type="button"
                    :disabled="isSavingNote"
                    @click="savePersonalNote"
                  >
                    <i
                      class="bi bi-journal-check me-1"
                      aria-hidden="true"
                    ></i>

                    {{
                      isSavingNote
                        ? 'Salvataggio...'
                        : 'Salva nota'
                    }}
                  </button>
                </div>

                <div
                  v-else
                  class="login-note-box"
                >
                  <i
                    class="bi bi-lock"
                    aria-hidden="true"
                  ></i>

                  <p class="mb-0">
                    Effettua il login per lasciare una nota personale su questa specie.
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>

        <div
          v-else
          class="empty-detail-card"
        >
          <i
            class="bi bi-exclamation-triangle"
            aria-hidden="true"
          ></i>

          <h1 class="h4 fw-bold mt-3">
            Specie non trovata
          </h1>

          <p class="text-muted mb-0">
            Non è stato possibile recuperare i dettagli della specie richiesta.
          </p>
        </div>
      </div>
    </section>

    <div
      v-if="removeFavoriteDialogOpen"
      class="confirm-backdrop"
      role="presentation"
      @click.self="closeRemoveFavoriteDialog"
    >
      <section
        class="confirm-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="remove-favorite-detail-title"
        aria-describedby="remove-favorite-detail-description"
      >
        <div class="confirm-icon">
          <i
            class="bi bi-exclamation-triangle"
            aria-hidden="true"
          ></i>
        </div>

        <h2
          id="remove-favorite-detail-title"
          class="h5 fw-bold mb-2"
        >
          Rimuovere dai preferiti?
        </h2>

        <p
          id="remove-favorite-detail-description"
          class="text-muted mb-4"
        >
          Sei sicuro di voler rimuovere
          <strong>{{ getSpeciesName() }}</strong>
          dai tuoi preferiti?
        </p>

        <div class="d-flex justify-content-end gap-2">
          <button
            class="btn btn-outline-secondary"
            type="button"
            :disabled="isRemovingFavorite"
            @click="closeRemoveFavoriteDialog"
          >
            Annulla
          </button>

          <button
            class="btn btn-danger"
            type="button"
            :disabled="isRemovingFavorite"
            @click="confirmRemoveFavoriteFromDetail"
          >
            <span
              v-if="isRemovingFavorite"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            Rimuovi
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.species-detail-page {
  min-height: 100vh;
  color: var(--bioquest-text, #1b4332);
  background:
    radial-gradient(circle at top left, rgba(0, 189, 126, 0.14), transparent 32rem),
    linear-gradient(
      180deg,
      var(--bioquest-bg, #f8fffb) 0%,
      var(--bioquest-surface, #ffffff) 45%,
      var(--bioquest-bg, #f7fbf9) 100%
    );
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
  color: var(--bioquest-primary-medium, #008f5f);
  font-weight: 600;
  text-decoration: none;
}

.back-link:hover,
.back-link:focus {
  color: var(--bioquest-primary-dark, #006f4a);
  text-decoration: underline;
}

.loading-card,
.empty-detail-card {
  display: flex;
  min-height: 420px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.22));
  border-radius: 1.5rem;
  background-color: var(--bioquest-surface, #ffffff);
  color: var(--bioquest-muted, #52796f);
  box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.06);
}

.empty-detail-card i {
  color: var(--bioquest-primary, #00bd7e);
  font-size: 2.5rem;
}

.detail-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.75rem;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.24));
  border-radius: 1.5rem;
  background-color: var(--bioquest-surface, rgba(255, 255, 255, 0.92));
  box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.06);
}

.section-kicker {
  color: var(--bioquest-primary, #00bd7e);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.detail-title {
  margin-bottom: 0.35rem;
  color: var(--bioquest-heading, #1b4332);
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: 800;
  line-height: 1;
}

.scientific-name {
  color: var(--bioquest-muted, #52796f);
  font-size: 1.05rem;
  font-style: italic;
}

.login-required-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  flex: 0 0 auto;
  padding: 0.8rem 1rem;
  border: 1px dashed rgba(0, 189, 126, 0.35);
  border-radius: 999px;
  color: #52796f;
  background-color: rgba(0, 189, 126, 0.08);
  font-weight: 700;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.login-required-button:hover,
.login-required-button:focus {
  border-color: #00bd7e;
  color: #008f5f;
  background-color: rgba(0, 189, 126, 0.14);
}

.login-required-button i {
  color: #00bd7e;
  font-size: 1.1rem;
}

.favorite-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  flex: 0 0 auto;
  padding: 0.8rem 1rem;
  border: 1px solid var(--bioquest-border-strong, rgba(0, 189, 126, 0.35));
  border-radius: 999px;
  color: var(--bioquest-primary-medium, #008f5f);
  background-color: var(--bioquest-surface, #ffffff);
  font-weight: 700;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.favorite-button:hover,
.favorite-button:focus {
  border-color: var(--bioquest-primary, #00bd7e);
  background-color: var(--bioquest-primary-soft, rgba(0, 189, 126, 0.12));
  transform: translateY(-1px);
}

.favorite-button:focus-visible {
  outline: 3px solid rgba(0, 189, 126, 0.35);
  outline-offset: 3px;
}

.favorite-button.active {
  border-color: var(--bioquest-primary, #00bd7e);
  color: #ffffff;
  background-color: var(--bioquest-primary, #00bd7e);
}

.taxonomy-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.65rem;
}

.taxonomy-pill {
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.26));
  border-radius: 0.9rem;
  background-color: var(--bioquest-surface, rgba(255, 255, 255, 0.88));
}

.taxonomy-pill span {
  display: block;
  color: var(--bioquest-muted, #52796f);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.taxonomy-pill strong {
  display: block;
  overflow: hidden;
  color: var(--bioquest-heading, #1b4332);
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-card,
.description-card {
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.22));
  border-radius: 1.5rem;
  background-color: var(--bioquest-surface, #ffffff);
  color: var(--bioquest-text, #1b4332);
  box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.06);
}

.image-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 460px;
  padding: 0.75rem;
  background-color: var(--bioquest-surface-soft, #f8f9fa);
}

.species-image {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 560px;
  object-fit: contain;
  object-position: center;
  background-color: transparent;
}

.species-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 460px;
  flex-direction: column;
  gap: 0.75rem;
  color: var(--bioquest-muted, #52796f);
  background-color: var(--bioquest-primary-soft, rgba(0, 189, 126, 0.1));
}

.species-image-placeholder i {
  color: var(--bioquest-primary, #00bd7e);
  font-size: 3rem;
}

.description-card {
  padding: 1.5rem;
}

.description-card h2,
.note-card h2 {
  color: var(--bioquest-heading, #1b4332);
}

.description-text {
  color: var(--bioquest-muted, #52796f);
  font-size: 1rem;
  line-height: 1.7;
}

.source-link {
  display: inline-flex;
  align-items: center;
  margin-top: 0.75rem;
  color: var(--bioquest-primary-medium, #008f5f);
  font-weight: 700;
  text-decoration: none;
}

.source-link:hover,
.source-link:focus {
  color: var(--bioquest-primary-dark, #006f4a);
  text-decoration: underline;
}

.observation-summary {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.24));
  border-radius: 1rem;
  background-color: var(--bioquest-primary-soft, rgba(0, 189, 126, 0.08));
}

.observation-summary h3 {
  color: var(--bioquest-heading, #1b4332);
}

.observation-summary ul {
  padding: 0;
  margin: 0;
  list-style: none;
}

.observation-summary li {
  color: var(--bioquest-muted, #52796f);
  font-size: 0.95rem;
}

.observation-summary li + li {
  margin-top: 0.45rem;
}

.note-card {
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.22));
  border-radius: 1rem;
  background-color: var(--bioquest-surface, #ffffff);
  color: var(--bioquest-text, #1b4332);
  box-shadow: 0 0.75rem 1.5rem rgba(0, 0, 0, 0.05);
}

.note-label {
  color: var(--bioquest-muted, #52796f);
  font-size: 0.9rem;
}

.note-textarea {
  resize: vertical;
  border-color: var(--bioquest-border-strong, rgba(0, 189, 126, 0.28));
  font-size: 0.95rem;
}

.note-textarea:focus {
  border-color: var(--bioquest-primary, #00bd7e);
  box-shadow: 0 0 0 0.25rem rgba(0, 189, 126, 0.18);
}

.login-note-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 90px;
  padding: 0.85rem;
  border: 1px dashed var(--bioquest-border-strong, rgba(0, 189, 126, 0.35));
  border-radius: 0.85rem;
  color: var(--bioquest-muted, #52796f);
  background-color: var(--bioquest-primary-soft, rgba(0, 189, 126, 0.08));
  font-size: 0.95rem;
}

.login-note-box i {
  color: var(--bioquest-primary, #00bd7e);
  font-size: 1.25rem;
}

.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.45);
}

.confirm-dialog {
  width: min(100%, 430px);
  padding: 1.5rem;
  border-radius: 1rem;
  color: var(--bioquest-text, #1b1f23);
  background-color: var(--bioquest-surface, #ffffff);
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.22);
}

.confirm-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-bottom: 1rem;
  border-radius: 50%;
  color: #dc3545;
  background-color: rgba(220, 53, 69, 0.12);
  font-size: 1.35rem;
}

:global(html[data-theme='dark']) .species-detail-page {
  background:
    radial-gradient(circle at top left, rgba(0, 189, 126, 0.12), transparent 32rem),
    linear-gradient(
      180deg,
      var(--bioquest-bg, #101513) 0%,
      var(--bioquest-surface-soft, #131b18) 48%,
      var(--bioquest-bg, #101513) 100%
    );
}

:global(html[data-theme='dark']) .loading-card,
:global(html[data-theme='dark']) .empty-detail-card,
:global(html[data-theme='dark']) .detail-hero,
:global(html[data-theme='dark']) .image-card,
:global(html[data-theme='dark']) .description-card,
:global(html[data-theme='dark']) .note-card {
  box-shadow: 0 1rem 2.4rem rgba(0, 0, 0, 0.3);
}

@media (max-width: 991px) {
  .detail-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .favorite-button,
  .login-required-button {
    width: 100%;
  }

  .image-card {
    min-height: 340px;
  }

  .species-image {
    max-height: 340px;
  }

  .species-image-placeholder {
    min-height: 340px;
  }

  .note-card {
    max-width: 100%;
  }
}
</style>