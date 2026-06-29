<!-- Home: ricerca specie tramite API GBIF con Axios, preferiti, persistenza e supporto ARIA -->
<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../firebase'
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'

import SpeciesCard from '../components/SpeciesCard.vue'
import AppNavbar from '../components/AppNavbar.vue'
import { searchSpeciesByName } from '../services/gbifService'

const username = localStorage.getItem('bioquestUser')

const searchTerm = ref('')
const species = ref([])
const favoriteIds = ref([])
const isLoading = ref(false)
const message = ref('')

const formattedUsername =
  username.charAt(0).toUpperCase() +
  username.slice(1)

function saveHomeState() {
  sessionStorage.setItem('bioquestHomeState', JSON.stringify({
    searchTerm: searchTerm.value,
    species: species.value,
    message: message.value
  }))
}

function restoreHomeState() {
  const savedState = sessionStorage.getItem('bioquestHomeState')

  if (!savedState) return

  const parsedState = JSON.parse(savedState)

  searchTerm.value = parsedState.searchTerm || ''
  species.value = parsedState.species || []
  message.value = parsedState.message || ''
}

async function searchSpecies() {
  const cleanSearch = searchTerm.value.trim()

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

    species.value = data.results.filter(
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
  if (!username) return

  const querySnapshot = await getDocs(
    collection(db, 'users', username, 'favorites')
  )

  favoriteIds.value = querySnapshot.docs.map(doc => doc.id)
}

function isFavorite(speciesId) {
  return favoriteIds.value.includes(String(speciesId))
}

async function toggleFavorite(speciesItem) {
  const id = String(speciesItem.key)

  if (isFavorite(id)) {
    await deleteDoc(
      doc(db, 'users', username, 'favorites', id)
    )

    favoriteIds.value = favoriteIds.value.filter(
      favoriteId => favoriteId !== id
    )

    return
  }

  await setDoc(
    doc(db, 'users', username, 'favorites', id),
    {
      scientificName: speciesItem.scientificName,
      kingdom: speciesItem.kingdom || '',
      family: speciesItem.family || '',
      rank: speciesItem.rank || '',
      savedAt: new Date().toISOString()
    }
  )

  favoriteIds.value.push(id)
}

onMounted(() => {
  restoreHomeState()
  loadFavoriteIds()
})
</script>

<template>
  <main>
    <AppNavbar />

    <section
      class="container py-4"
      aria-labelledby="home-title"
    >
      <div class="hero-card mb-4">
        <div class="hero-content">
          <p class="hero-kicker mb-2">
            <i
              class="bi bi-tree-fill me-2"
              aria-hidden="true"
            ></i>
            BioQuest Explorer
          </p>

          <h1
            id="home-title"
            class="fw-bold mb-3"
          >
            Esplora la biodiversità
          </h1>

          <p class="hero-subtitle mb-2">
            <i
              class="bi bi-person-fill me-2"
              aria-hidden="true"
            ></i>
            Ciao {{ formattedUsername }}
          </p>

          <p class="mb-0">
            Cerca specie reali tramite GBIF, salva i tuoi preferiti e scopri osservazioni geografiche sulla mappa.
          </p>
        </div>
      </div>

      <div
        class="search-panel mb-4"
        aria-label="Ricerca specie"
      >
        <label
          for="species-search"
          class="form-label visually-hidden"
        >
          Cerca una specie
        </label>

        <div class="input-group">
          <input
            id="species-search"
            v-model="searchTerm"
            class="form-control"
            type="text"
            placeholder="Cerca una specie, es. Canis lupus"
            aria-describedby="species-search-help"
            @keyup.enter="searchSpecies"
          />

          <button
            class="btn btn-success"
            type="button"
            :disabled="isLoading"
            aria-label="Avvia la ricerca della specie"
            @click="searchSpecies"
          >
            <i
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
          <strong>Canis lupus</strong>. Alcuni nomi comuni potrebbero non essere riconosciuti.
        </small>
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
        v-if="isLoading"
        class="alert alert-secondary"
        role="status"
        aria-live="polite"
      >
        Ricerca in corso...
      </div>

      <div
        v-else-if="species.length > 0"
        class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4"
        aria-label="Risultati della ricerca"
      >
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

      <div
        v-else-if="!message"
        class="text-center py-5 text-muted"
        role="status"
        aria-live="polite"
      >
        <i
          class="bi bi-binoculars-fill"
          style="font-size: 2.5rem;"
          aria-hidden="true"
        ></i>

        <p class="mt-3 mb-0">
          Nessuna specie visualizzata.
        </p>

        <small>
          Utilizza la barra di ricerca per iniziare l'esplorazione.
        </small>
      </div>
    </section>
  </main>
</template>

<style scoped>
.hero-card {
  color: white;
  background: linear-gradient(
    135deg,
    #2d6a4f,
    #40916c
  );
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
}

.hero-kicker {
  font-weight: 600;
  opacity: 0.95;
}

.hero-subtitle {
  font-size: 1.15rem;
  font-weight: 600;
  opacity: 0.95;
}

.search-panel {
  padding: 1rem;
  border: 1px solid #d8f3dc;
  border-radius: 1rem;
  background-color: #f8fff8;
}

.search-help {
  color: #52796f;
}
</style>