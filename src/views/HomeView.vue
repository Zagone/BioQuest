<!-- Home: ricerca specie GBIF, risultati, preferiti con conferma e feedback toast -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { db } from '../firebase'
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'

import AppNavbar from '../components/AppNavbar.vue'
import AppToast from '../components/AppToast.vue'
import SpeciesCard from '../components/SpeciesCard.vue'
import { searchSpeciesByName } from '../services/gbifService'

const username = ref(localStorage.getItem('bioquestUser') || '')

const searchTerm = ref('')
const species = ref([])
const favoriteIds = ref([])
const isLoading = ref(false)
const message = ref('')
const hasSearched = ref(false)

const removeFavoriteDialogOpen = ref(false)
const favoriteToRemove = ref(null)
const isRemovingFavorite = ref(false)

const toastMessage = ref('')
const toastType = ref('info')
const toastVisible = ref(false)

const formattedUsername = computed(() => {
  if (!username.value) return ''
  return username.value.charAt(0).toUpperCase() + username.value.slice(1)
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

function updateLoggedUser() {
  username.value = localStorage.getItem('bioquestUser') || ''
  loadFavoriteIds()
}

function resetHomeAfterLogout() {
  username.value = ''
  favoriteIds.value = []
  removeFavoriteDialogOpen.value = false
  favoriteToRemove.value = null
  isRemovingFavorite.value = false
}

function saveHomeState() {
  sessionStorage.setItem('bioquestHomeState', JSON.stringify({
    searchTerm: searchTerm.value,
    species: species.value,
    message: message.value,
    hasSearched: hasSearched.value
  }))
}

function restoreHomeState() {
  const savedState = sessionStorage.getItem('bioquestHomeState')

  if (!savedState) return

  try {
    const parsedState = JSON.parse(savedState)

    searchTerm.value = parsedState.searchTerm || ''
    species.value = parsedState.species || []
    message.value = parsedState.message || ''
    hasSearched.value = parsedState.hasSearched || false
  } catch (error) {
    sessionStorage.removeItem('bioquestHomeState')
  }
}

async function searchSpecies() {
  const cleanSearch = searchTerm.value.trim()

  hasSearched.value = true

  if (!cleanSearch) {
    species.value = []
    message.value = 'Inserisci il nome di una specie da cercare.'
    saveHomeState()
    return
  }

  isLoading.value = true
  message.value = ''
  species.value = []

  try {
    const data = await searchSpeciesByName(cleanSearch)

    species.value = (data.results || []).filter(
      item => item.scientificName && item.rank
    )

    if (species.value.length === 0) {
      message.value = 'Nessuna specie trovata. Prova con un nome scientifico, ad esempio Canis lupus.'
    }

    saveHomeState()
  } catch (error) {
    species.value = []
    message.value = 'Errore durante la ricerca. Riprova tra qualche secondo.'
    saveHomeState()
  } finally {
    isLoading.value = false
  }
}

async function loadFavoriteIds() {
  const currentUsername = username.value

  if (!currentUsername) {
    favoriteIds.value = []
    return
  }

  try {
    const querySnapshot = await getDocs(
      collection(db, 'users', currentUsername, 'favorites')
    )

    if (username.value !== currentUsername) return

    favoriteIds.value = querySnapshot.docs.map(docItem => docItem.id)
  } catch (error) {
    if (username.value === currentUsername) {
      favoriteIds.value = []
    }
  }
}

function isFavorite(speciesId) {
  return favoriteIds.value.includes(String(speciesId))
}

function getSpeciesName(speciesItem) {
  return (
    speciesItem.vernacularName ||
    speciesItem.canonicalName ||
    speciesItem.scientificName ||
    'questa specie'
  )
}

function openRemoveFavoriteDialog(speciesItem) {
  favoriteToRemove.value = speciesItem
  removeFavoriteDialogOpen.value = true
}

function closeRemoveFavoriteDialog() {
  if (isRemovingFavorite.value) return

  removeFavoriteDialogOpen.value = false
  favoriteToRemove.value = null
}

async function confirmRemoveFavorite() {
  if (!username.value || !favoriteToRemove.value) return

  const id = String(favoriteToRemove.value.key)

  isRemovingFavorite.value = true

  try {
    await deleteDoc(
      doc(db, 'users', username.value, 'favorites', id)
    )

    favoriteIds.value = favoriteIds.value.filter(
      favoriteId => favoriteId !== id
    )

    removeFavoriteDialogOpen.value = false
    favoriteToRemove.value = null

    showToast('Specie rimossa dai preferiti.', 'success')
  } catch (error) {
    showToast('Errore durante la rimozione dai preferiti.', 'error')
  } finally {
    isRemovingFavorite.value = false
  }
}

async function toggleFavorite(speciesItem) {
  if (!username.value) {
    showToast('Accedi per salvare una specie nei preferiti.', 'warning')
    return
  }

  const id = String(speciesItem.key)

  if (isFavorite(id)) {
    openRemoveFavoriteDialog(speciesItem)
    return
  }

  try {
    await setDoc(
      doc(db, 'users', username.value, 'favorites', id),
      {
        scientificName: speciesItem.scientificName || '',
        vernacularName: speciesItem.vernacularName || '',
        canonicalName: speciesItem.canonicalName || '',
        kingdom: speciesItem.kingdom || '',
        family: speciesItem.family || '',
        rank: speciesItem.rank || '',
        imageUrl: '',
        savedAt: new Date().toISOString()
      }
    )

    favoriteIds.value.push(id)
    showToast('Specie aggiunta ai preferiti.', 'success')
  } catch (error) {
    showToast('Errore durante il salvataggio nei preferiti.', 'error')
  }
}

onMounted(() => {
  restoreHomeState()
  loadFavoriteIds()

  window.addEventListener('bioquest-auth-changed', updateLoggedUser)
  window.addEventListener('bioquest-user-reset', resetHomeAfterLogout)
})

onBeforeUnmount(() => {
  window.removeEventListener('bioquest-auth-changed', updateLoggedUser)
  window.removeEventListener('bioquest-user-reset', resetHomeAfterLogout)
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
      class="hero-section d-flex align-items-center text-white"
      aria-labelledby="home-title"
    >
      <div class="hero-overlay w-100 h-100 d-flex align-items-center">
        <div class="container text-center">
          <div class="row justify-content-center">
            <div class="col-12 col-lg-10">
              <h1
                id="home-title"
                class="display-3 fw-bold mb-4 hero-title"
              >
                Esplora il mondo animale,
                <span v-if="formattedUsername">
                  {{ formattedUsername }}
                </span>
              </h1>

              <p class="lead mb-4 hero-subtitle">
                Scopri migliaia di specie animali attraverso dati scientifici reali
                del network globale GBIF.
              </p>

              <div class="mt-4 small hero-payoff mb-5">
                Conosci. Esplora. Ricorda.
              </div>

              <div
                class="hero-search-panel mx-auto"
                aria-label="Ricerca specie"
              >
                <label
                  for="species-search"
                  class="form-label visually-hidden"
                >
                  Cerca una specie
                </label>

                <div class="input-group input-group-lg">
                  <input
                    id="species-search"
                    v-model="searchTerm"
                    class="form-control hero-search-input"
                    type="text"
                    placeholder="Cerca una specie, es. Canis lupus"
                    aria-describedby="species-search-help"
                    :disabled="isLoading"
                    @keyup.enter="searchSpecies"
                  />

                  <button
                    class="btn btn-success hero-search-button"
                    type="button"
                    :disabled="isLoading"
                    aria-label="Avvia la ricerca della specie"
                    @click="searchSpecies"
                  >
                    <span
                      v-if="isLoading"
                      class="spinner-border spinner-border-sm me-2"
                      aria-hidden="true"
                    ></span>

                    <i
                      v-else
                      class="bi bi-search me-1"
                      aria-hidden="true"
                    ></i>

                    {{ isLoading ? 'Ricerca...' : 'Cerca' }}
                  </button>
                </div>

                <small
                  id="species-search-help"
                  class="search-help d-block mt-2"
                >
                  Per risultati più precisi usa il nome scientifico, ad esempio
                  <strong>Canis lupus</strong>.
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      class="container my-5"      
    >
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
        v-if="isLoading"
        class="alert alert-secondary"
        role="status"
        aria-live="polite"
      >
        Ricerca in corso...
      </div>

      <div
        v-else-if="species.length > 0"
      >
        <div class="d-flex justify-content-between align-items-start flex-column flex-md-row gap-2 mb-3">
          <div>
            <h2
              id="results-title"
              class="fw-bold text-success mb-1"
            >
              Specie trovate
            </h2>

            <p class="text-muted mb-0">
              Risultati ottenuti dalla ricerca su GBIF.
            </p>
          </div>

          <span class="results-count">
            {{ species.length }} risultati
          </span>
        </div>

        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4">
          <div
            v-for="item in species"
            :key="item.key"
            class="col"
          >
            <SpeciesCard
              :species="item"
              :is-favorite="isFavorite(item.key)"
              @toggle-favorite="toggleFavorite"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="hasSearched && !message"
        class="text-center py-5 text-muted"
        role="status"
        aria-live="polite"
      >
        <i
          class="bi bi-binoculars-fill empty-results-icon"
          aria-hidden="true"
        ></i>

        <p class="mt-3 mb-0">
          Nessuna specie visualizzata.
        </p>
      </div>
    </section>

    <section
      v-if="!hasSearched && species.length === 0"
      class="container my-5"
      aria-labelledby="intro-title"
    >
      <div class="row justify-content-center text-center">
        <div class="col-12 col-lg-9">
          <h2
            id="intro-title"
            class="fw-bold text-success mb-4"
          >
            La biodiversità del pianeta
          </h2>

          <p class="text-muted fs-5">
            BioQuest utilizza il database globale <strong>GBIF</strong>, una delle più
            grandi raccolte scientifiche sulla biodiversità. Qui puoi esplorare specie
            animali, comprenderne la classificazione e costruire il tuo taccuino
            personale di studio.
          </p>
        </div>
      </div>

      <div class="row g-4 mt-4">
        <div class="col-12 col-md-4">
          <article class="info-card h-100 text-center">
            <div class="info-icon mx-auto mb-3">
              <i
                class="bi bi-diagram-3"
                aria-hidden="true"
              ></i>
            </div>

            <h3 class="h5 fw-bold">
              Dati Scientifici
            </h3>

            <p class="text-muted mb-0">
              Informazioni tassonomiche reali utilizzate dalla comunità scientifica
              internazionale.
            </p>
          </article>
        </div>

        <div class="col-12 col-md-4">
          <article class="info-card h-100 text-center">
            <div class="info-icon mx-auto mb-3">
              <i
                class="bi bi-geo-alt"
                aria-hidden="true"
              ></i>
            </div>

            <h3 class="h5 fw-bold">
              Mappe e Areali
            </h3>

            <p class="text-muted mb-0">
              Visualizza la distribuzione geografica delle specie nel loro habitat
              naturale.
            </p>
          </article>
        </div>

        <div class="col-12 col-md-4">
          <article class="info-card h-100 text-center">
            <div class="info-icon mx-auto mb-3">
              <i
                class="bi bi-journal-text"
                aria-hidden="true"
              ></i>
            </div>

            <h3 class="h5 fw-bold">
              Taccuino Cloud
            </h3>

            <p class="text-muted mb-0">
              Salva specie preferite e annotazioni personali per costruire il tuo
              diario naturalistico.
            </p>
          </article>
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
        aria-labelledby="remove-home-favorite-title"
        aria-describedby="remove-home-favorite-description"
      >
        <div class="confirm-icon">
          <i
            class="bi bi-exclamation-triangle"
            aria-hidden="true"
          ></i>
        </div>

        <h2
          id="remove-home-favorite-title"
          class="h5 fw-bold mb-2"
        >
          Rimuovere dai preferiti?
        </h2>

        <p
          id="remove-home-favorite-description"
          class="text-muted mb-4"
        >
          Sei sicuro di voler rimuovere
          <strong>{{ favoriteToRemove ? getSpeciesName(favoriteToRemove) : 'questa specie' }}</strong>
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
            @click="confirmRemoveFavorite"
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
.hero-section {
  min-height: 450px;
  background-image:
    linear-gradient(
      rgba(0, 0, 0, 0.45),
      rgba(0, 0, 0, 0.45)
    ),
    url("https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=1920&q=80");
  background-position: center;
  background-size: cover;
}

.hero-overlay {
  min-height: 450px;
}

.hero-title {
  color: #ffffff;
  text-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.45);
}

.hero-subtitle {
  color: #f1f3f5;
}

.hero-payoff {
  color: #dee2e6;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-search-panel {
  max-width: 760px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  box-shadow: none;
}

.hero-search-input {
  border: 0;
  background-color: rgba(255, 255, 255, 0.92);
}

.hero-search-input:focus {
  background-color: rgba(255, 255, 255, 0.98);
}

.hero-search-button {
  border: 0;
  font-weight: 700;
}

.search-help {
  color: rgba(255, 255, 255, 0.9);
}

.results-count {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--bioquest-border-strong, #b7e4c7);
  border-radius: 999px;
  color: var(--bioquest-primary-dark, #2d6a4f);
  background-color: var(--bioquest-surface-soft, #f8fff8);
  font-size: 0.95rem;
  font-weight: 700;
}

.empty-results-icon {
  font-size: 2.5rem;
}

.info-card {
  padding: 2rem 1.5rem;
  border: 1px solid var(--bioquest-border-strong, #b7e4c7);
  border-radius: 1rem;
  background-color: var(--bioquest-surface, #ffffff);
  box-shadow: 0 0.5rem 1.25rem rgba(27, 67, 50, 0.06);
}

.info-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border: 1px solid var(--bioquest-border-strong, #95d5b2);
  border-radius: 50%;
  color: var(--bioquest-primary-dark, #2d6a4f);
  background-color: var(--bioquest-surface-soft, #f8fff8);
  font-size: 1.5rem;
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
  border: 1px solid var(--bioquest-border, transparent);
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
  color: var(--bioquest-danger, #dc3545);
  background-color: rgba(220, 53, 69, 0.12);
  font-size: 1.35rem;
}

:global(html[data-theme='dark']) .confirm-dialog {
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.34);
}

@media (max-width: 575px) {
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