<!-- Profilo: dashboard personale con preferiti, statistiche, dati profilo e supporto ARIA -->
<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../firebase'
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore'
import Chart from 'chart.js/auto'
import AppNavbar from '../components/AppNavbar.vue'

const router = useRouter()
const username = localStorage.getItem('bioquestUser')

const favorites = ref([])
const favoritesCount = ref(0)
const chartCanvas = ref(null)
const hasChartData = ref(false)

const memberSince = ref('Non disponibile')
const mostRepresentedKingdom = ref('Non disponibile')
const latestFavoriteName = ref('Non disponibile')

let chartInstance = null

const formattedUsername =
  username.charAt(0).toUpperCase() +
  username.slice(1)

function formatDate(value) {
  if (!value) return 'Non disponibile'

  const date = new Date(value)

  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

function getKingdomsCount() {
  const kingdomsCount = {}

  favorites.value.forEach(favorite => {
    const kingdom = favorite.kingdom || 'Non disponibile'
    kingdomsCount[kingdom] = (kingdomsCount[kingdom] || 0) + 1
  })

  return kingdomsCount
}

async function loadUserData() {
  if (!username) return

  const userRef = doc(db, 'users', username)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) return

  const userData = userSnap.data()

  memberSince.value = formatDate(userData.createdAt)
}

async function loadProfileData() {
  if (!username) return

  const querySnapshot = await getDocs(
    collection(db, 'users', username, 'favorites')
  )

  favorites.value = querySnapshot.docs.map(docItem => ({
    id: docItem.id,
    ...docItem.data()
  }))

  favorites.value.sort((a, b) =>
    (b.savedAt || '').localeCompare(a.savedAt || '')
  )

  favoritesCount.value = favorites.value.length

  updateSimpleStats()

  await createKingdomChart()
}

function updateSimpleStats() {
  if (favorites.value.length === 0) {
    mostRepresentedKingdom.value = 'Non disponibile'
    latestFavoriteName.value = 'Non disponibile'
    return
  }

  latestFavoriteName.value =
    favorites.value[0].scientificName || 'Non disponibile'

  const kingdomsCount = getKingdomsCount()

  const sortedKingdoms = Object.entries(kingdomsCount).sort(
    (a, b) => b[1] - a[1]
  )

  mostRepresentedKingdom.value = sortedKingdoms[0][0]
}

async function createKingdomChart() {
  if (favorites.value.length === 0) {
    hasChartData.value = false

    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }

    return
  }

  hasChartData.value = true
  await nextTick()

  const kingdomsCount = getKingdomsCount()

  if (chartInstance) {
    chartInstance.destroy()
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels: Object.keys(kingdomsCount),
      datasets: [
        {
          label: 'Numero di preferiti',
          data: Object.values(kingdomsCount)
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  })
}

function openFavoriteDetail(favorite) {
  if (favorite.observationImageUrl) {
    sessionStorage.setItem(
      'bioquestSelectedObservation',
      JSON.stringify({
        speciesKey: favorite.id,
        country: favorite.observationCountry || '',
        eventDate: favorite.observationDate || '',
        locality: favorite.observationLocality || '',
        decimalLatitude: favorite.observationLatitude || '',
        decimalLongitude: favorite.observationLongitude || '',
        media: [
          {
            identifier: favorite.observationImageUrl,
            type: 'StillImage'
          }
        ]
      })
    )
  } else {
    sessionStorage.removeItem('bioquestSelectedObservation')
  }

  router.push(`/species/${favorite.id}`)
}

async function removeFavorite(favoriteId) {
  await deleteDoc(
    doc(db, 'users', username, 'favorites', favoriteId)
  )

  favorites.value = favorites.value.filter(
    favorite => favorite.id !== favoriteId
  )

  favoritesCount.value = favorites.value.length

  updateSimpleStats()

  await createKingdomChart()
}

onMounted(() => {
  loadUserData()
  loadProfileData()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<template>
  <main>
    <AppNavbar />

    <section
      class="container py-4"
      aria-labelledby="profile-title"
    >
      <h1
        id="profile-title"
        class="fw-bold mb-4"
      >
        Profilo
      </h1>

      <div
        class="row g-4 mb-4"
        aria-label="Riepilogo del profilo personale"
      >
        <div class="col-12 col-lg-4">
          <div class="card shadow-sm h-100 profile-card">
            <div class="card-body text-center">
              <i
                class="bi bi-person-circle profile-icon"
                aria-hidden="true"
              ></i>

              <h4 class="mt-3">
                {{ formattedUsername }}
              </h4>

              <p class="text-muted mb-2">
                Esploratore BioQuest
              </p>

              <p class="member-date mb-0">
                <i
                  class="bi bi-calendar3 me-1"
                  aria-hidden="true"
                ></i>
                Membro dal {{ memberSince }}
              </p>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-8">
          <div class="card shadow-sm h-100">
            <div class="card-body">
              <h5
                id="personal-summary-title"
                class="card-title mb-3"
              >
                Riepilogo personale
              </h5>

              <div
                class="row g-3"
                aria-labelledby="personal-summary-title"
              >
                <div class="col-12 col-md-4">
                  <div class="stat-box">
                    <small class="text-muted">
                      Preferiti salvati
                    </small>

                    <h3 class="mb-0">
                      {{ favoritesCount }}
                    </h3>
                  </div>
                </div>

                <div class="col-12 col-md-4">
                  <div class="stat-box">
                    <small class="text-muted">
                      Regno più rappresentato
                    </small>

                    <h5 class="mb-0">
                      {{ mostRepresentedKingdom }}
                    </h5>
                  </div>
                </div>

                <div class="col-12 col-md-4">
                  <div class="stat-box">
                    <small class="text-muted">
                      Ultima specie salvata
                    </small>

                    <h5 class="mb-0">
                      {{ latestFavoriteName }}
                    </h5>
                  </div>
                </div>
              </div>

              <h5
                id="statistics-title"
                class="mt-4"
              >
                Statistiche
              </h5>

              <div
                v-if="!hasChartData"
                class="alert alert-info mt-3"
                role="status"
                aria-live="polite"
              >
                Salva almeno una specie nei preferiti per visualizzare il grafico.
              </div>

              <div
                v-else
                class="chart-container mt-3"
                aria-labelledby="statistics-title"
              >
                <canvas
                  ref="chartCanvas"
                  role="img"
                  aria-label="Grafico a barre del numero di specie preferite raggruppate per regno"
                ></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="card shadow-sm"
        aria-labelledby="favorites-title"
      >
        <div class="card-body">
          <h5
            id="favorites-title"
            class="card-title mb-3"
          >
            Preferiti
          </h5>

          <div
            v-if="favorites.length === 0"
            class="alert alert-info"
            role="status"
            aria-live="polite"
          >
            Non hai ancora salvato specie.
          </div>

          <div
            v-else
            class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4"
            aria-label="Elenco delle specie salvate nei preferiti"
          >
            <div
              v-for="favorite in favorites"
              :key="favorite.id"
              class="col"
            >
              <div
                class="card h-100 shadow-sm favorite-card"
                :aria-label="`Preferito ${favorite.scientificName}`"
              >
                <img
                  v-if="favorite.observationImageUrl"
                  :src="favorite.observationImageUrl"
                  :alt="`Immagine dell'avvistamento di ${favorite.scientificName}`"
                  class="favorite-image"
                />

                <div class="card-body">
                  <button
                    class="favorite-title-button"
                    type="button"
                    :aria-label="`Apri il dettaglio di ${favorite.scientificName}`"
                    @click="openFavoriteDetail(favorite)"
                  >
                    {{ favorite.scientificName }}
                  </button>

                  <p class="card-text mb-1">
                    <strong>Regno:</strong>
                    {{ favorite.kingdom || 'Non disponibile' }}
                  </p>

                  <p class="card-text mb-1">
                    <strong>Famiglia:</strong>
                    {{ favorite.family || 'Non disponibile' }}
                  </p>

                  <p class="card-text mb-1">
                    <strong>Tipo:</strong>
                    {{ favorite.rank || 'Non disponibile' }}
                  </p>

                  <div
                    v-if="favorite.observationImageUrl"
                    class="observation-info mt-3"
                    aria-label="Dati dell'avvistamento salvato"
                  >
                    <p class="mb-1">
                      <strong>Avvistamento:</strong>
                      {{ favorite.observationCountry || 'Paese non disponibile' }}
                    </p>

                    <p class="mb-0">
                      <strong>Data:</strong>
                      {{ favorite.observationDate || 'Data non disponibile' }}
                    </p>
                  </div>
                </div>

                <div class="card-footer bg-white border-0">
                  <button
                    class="btn btn-outline-danger w-100"
                    type="button"
                    :aria-label="`Rimuovi ${favorite.scientificName} dai preferiti`"
                    @click="removeFavorite(favorite.id)"
                  >
                    <i
                      class="bi bi-trash me-1"
                      aria-hidden="true"
                    ></i>
                    Rimuovi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.profile-card {
  background-color: #f8fff8;
}

.profile-icon {
  font-size: 4rem;
  color: #2d6a4f;
}

.member-date {
  color: #2d6a4f;
  font-size: 0.9rem;
  font-weight: 600;
}

.stat-box {
  min-height: 100%;
  padding: 1rem;
  border: 1px solid #d8f3dc;
  border-radius: 0.75rem;
  background-color: #f8fff8;
}

.stat-box h3,
.stat-box h5 {
  color: #1b4332;
}

.chart-container {
  height: 320px;
}

.favorite-card {
  overflow: hidden;
  border-color: #d8f3dc;
}

.favorite-image {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.favorite-title-button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1b4332;
  font-size: 1.25rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.favorite-title-button:hover {
  text-decoration: underline;
}

.favorite-title-button:focus-visible {
  outline: 2px solid #2d6a4f;
  outline-offset: 3px;
  border-radius: 0.25rem;
}

.observation-info {
  padding-top: 0.75rem;
  border-top: 1px solid #d8f3dc;
  font-size: 0.9rem;
}
</style>