<!-- Profilo: dashboard personale con preferiti, avvistamenti, note, statistiche e impostazioni account -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../firebase'
import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore'
import Chart from 'chart.js/auto'
import AppNavbar from '../components/AppNavbar.vue'

const router = useRouter()
const username = localStorage.getItem('bioquestUser')

const favorites = ref([])
const notesMap = ref({})
const favoritesCount = ref(0)

const chartCanvas = ref(null)
const hasChartData = ref(false)

const memberSince = ref('Non disponibile')
const mostRepresentedKingdom = ref('Non disponibile')

const themePreference = ref(localStorage.getItem('bioquestTheme') || 'system')

const confirmDialogOpen = ref(false)
const favoriteToRemove = ref(null)
const isRemovingFavorite = ref(false)

const feedbackMessage = ref('')
const feedbackType = ref('success')

let chartInstance = null
let systemThemeMediaQuery = null

const formattedUsername = computed(() => {
  if (!username) return 'Utente'
  return username.charAt(0).toUpperCase() + username.slice(1)
})

const speciesFavorites = computed(() => {
  return favorites.value.filter(favorite => !hasObservationData(favorite))
})

const observationFavorites = computed(() => {
  return favorites.value.filter(favorite => hasObservationData(favorite))
})

const kingdomPercentages = computed(() => {
  if (favorites.value.length === 0) return []

  const kingdomsCount = getKingdomsCount()
  const total = favorites.value.length

  return Object.entries(kingdomsCount)
    .map(([kingdom, count]) => ({
      kingdom,
      count,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.count - a.count)
})

function resolveTheme(preference) {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return preference
}

function applyThemePreference(preference) {
  const activeTheme = resolveTheme(preference)

  localStorage.setItem('bioquestTheme', preference)
  document.documentElement.setAttribute('data-theme', activeTheme)
  document.documentElement.setAttribute('data-theme-preference', preference)
}

function updateThemePreference() {
  applyThemePreference(themePreference.value)
}

function handleSystemThemeChange() {
  if (themePreference.value === 'system') {
    applyThemePreference('system')
  }
}

function showFeedback(message, type = 'success') {
  feedbackMessage.value = message
  feedbackType.value = type

  window.setTimeout(() => {
    feedbackMessage.value = ''
  }, 3500)
}

function formatDate(value) {
  if (!value) return 'Non disponibile'

  let date

  if (typeof value?.toDate === 'function') {
    date = value.toDate()
  } else {
    date = new Date(value)
  }

  if (Number.isNaN(date.getTime())) return 'Non disponibile'

  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

function getFavoriteSavedTime(favorite) {
  const savedAt = favorite.savedAt

  if (!savedAt) return 0

  if (typeof savedAt?.toMillis === 'function') {
    return savedAt.toMillis()
  }

  const date = new Date(savedAt)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function getKingdomsCount() {
  const kingdomsCount = {}

  favorites.value.forEach(favorite => {
    const kingdom = favorite.kingdom || 'Non disponibile'
    kingdomsCount[kingdom] = (kingdomsCount[kingdom] || 0) + 1
  })

  return kingdomsCount
}

function hasObservationData(favorite) {
  return Boolean(
    favorite.observationImageUrl ||
    favorite.observationCountry ||
    favorite.observationDate ||
    favorite.observationLocality ||
    favorite.observationLatitude ||
    favorite.observationLongitude
  )
}

function getFavoriteName(favorite) {
  return (
    favorite.vernacularName ||
    favorite.commonName ||
    favorite.name ||
    favorite.canonicalName ||
    favorite.scientificName ||
    'Specie non disponibile'
  )
}

function getFavoriteNote(favorite) {
  const note = favorite.personalNote || favorite.note || notesMap.value[favorite.id]

  if (!note || !String(note).trim()) {
    return 'Nessuna nota personale salvata.'
  }

  return note
}

function hasFavoriteNote(favorite) {
  const note = favorite.personalNote || favorite.note || notesMap.value[favorite.id]
  return Boolean(note && String(note).trim())
}

function getObservationLocation(favorite) {
  return (
    favorite.observationLocality ||
    favorite.observationCountry ||
    'Luogo non disponibile'
  )
}

async function loadUserData() {
  if (!username) return

  try {
    const userRef = doc(db, 'users', username)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) return

    const userData = userSnap.data()
    memberSince.value = formatDate(userData.createdAt)
  } catch (error) {
    memberSince.value = 'Non disponibile'
  }
}

async function loadNotesData() {
  if (!username) return

  try {
    const notesSnapshot = await getDocs(
      collection(db, 'users', username, 'notes')
    )

    const loadedNotes = {}

    notesSnapshot.docs.forEach(noteDoc => {
      const noteData = noteDoc.data()
      loadedNotes[noteDoc.id] = noteData.text || noteData.note || noteData.content || ''
    })

    notesMap.value = loadedNotes
  } catch (error) {
    notesMap.value = {}
  }
}

async function loadProfileData() {
  if (!username) return

  try {
    await loadNotesData()

    const querySnapshot = await getDocs(
      collection(db, 'users', username, 'favorites')
    )

    favorites.value = querySnapshot.docs.map(docItem => ({
      id: docItem.id,
      ...docItem.data()
    }))

    favorites.value.sort((a, b) => {
      return getFavoriteSavedTime(b) - getFavoriteSavedTime(a)
    })

    favoritesCount.value = favorites.value.length

    updateSimpleStats()

    await createKingdomChart()
  } catch (error) {
    favorites.value = []
    favoritesCount.value = 0
    mostRepresentedKingdom.value = 'Non disponibile'
    hasChartData.value = false

    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }

    showFeedback('Errore durante il caricamento del profilo. Riprova tra qualche secondo.', 'danger')
  }
}

function updateSimpleStats() {
  if (favorites.value.length === 0) {
    mostRepresentedKingdom.value = 'Non disponibile'
    return
  }

  const kingdomsCount = getKingdomsCount()

  const sortedKingdoms = Object.entries(kingdomsCount).sort(
    (a, b) => b[1] - a[1]
  )

  mostRepresentedKingdom.value = sortedKingdoms[0]?.[0] || 'Non disponibile'
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
  const labels = Object.keys(kingdomsCount)
  const values = Object.values(kingdomsCount)
  const total = values.reduce((sum, value) => sum + value, 0)

  if (chartInstance) {
    chartInstance.destroy()
  }

  const percentageLabelsPlugin = {
    id: 'percentageLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart
      const dataset = chart.data.datasets[0]
      const meta = chart.getDatasetMeta(0)

      ctx.save()
      ctx.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      meta.data.forEach((arc, index) => {
        const value = dataset.data[index]
        const percentage = total > 0 ? Math.round((value / total) * 100) : 0

        if (percentage < 7) return

        const position = arc.tooltipPosition()
        ctx.fillText(`${percentage}%`, position.x, position.y)
      })

      ctx.restore()
    }
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: 'pie',
    data: {
      labels,
      datasets: [
        {
          label: 'Percentuale preferiti per regno',
          data: values,
          backgroundColor: [
            '#00bd7e',
            '#2d6a4f',
            '#74c69d',
            '#40916c',
            '#95d5b2',
            '#1b4332',
            '#52b788'
          ],
          borderColor: '#ffffff',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.raw
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0
              return `${context.label}: ${value} preferiti (${percentage}%)`
            }
          }
        }
      }
    },
    plugins: [percentageLabelsPlugin]
  })
}

function openFavoriteDetail(favorite) {
  if (hasObservationData(favorite)) {
    sessionStorage.setItem(
      'bioquestSelectedObservation',
      JSON.stringify({
        speciesKey: favorite.id,
        country: favorite.observationCountry || '',
        eventDate: favorite.observationDate || '',
        locality: favorite.observationLocality || '',
        decimalLatitude: favorite.observationLatitude || '',
        decimalLongitude: favorite.observationLongitude || '',
        media: favorite.observationImageUrl
          ? [
              {
                identifier: favorite.observationImageUrl,
                type: 'StillImage'
              }
            ]
          : []
      })
    )

    router.push({
      path: `/species/${favorite.id}`,
      query: {
        source: 'profile'
      }
    })

    return
  }

  sessionStorage.removeItem('bioquestSelectedObservation')

  router.push({
    path: `/species/${favorite.id}`,
    query: {
      source: 'profile'
    }
  })
}

function openRemoveDialog(favorite) {
  favoriteToRemove.value = favorite
  confirmDialogOpen.value = true
}

function closeRemoveDialog() {
  if (isRemovingFavorite.value) return

  confirmDialogOpen.value = false
  favoriteToRemove.value = null
}

async function confirmRemoveFavorite() {
  if (!favoriteToRemove.value || !username) return

  isRemovingFavorite.value = true

  try {
    await deleteDoc(
      doc(db, 'users', username, 'favorites', favoriteToRemove.value.id)
    )

    favorites.value = favorites.value.filter(
      favorite => favorite.id !== favoriteToRemove.value.id
    )

    favoritesCount.value = favorites.value.length

    updateSimpleStats()

    await createKingdomChart()

    confirmDialogOpen.value = false
    favoriteToRemove.value = null

    showFeedback('Preferito rimosso correttamente.', 'success')
  } catch {
    showFeedback('Errore durante la rimozione del preferito.', 'danger')
  } finally {
    isRemovingFavorite.value = false
  }
}

onMounted(() => {
  applyThemePreference(themePreference.value)

  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange)

  if (!username) {
    router.push('/home')
    return
  }

  loadUserData()
  loadProfileData()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  if (systemThemeMediaQuery) {
    systemThemeMediaQuery.removeEventListener('change', handleSystemThemeChange)
  }
})
</script>

<template>
  <main>
    <AppNavbar />

    <section
      class="container py-4 profile-page"
      aria-labelledby="profile-title"
    >
      <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-4">
        <div>
          <p class="section-kicker mb-1">
            Area personale
          </p>

          <h1
            id="profile-title"
            class="fw-bold mb-1"
          >
            Profilo
          </h1>

          <p class="text-muted mb-0">
            Gestisci preferiti, avvistamenti salvati e impostazioni del tuo account.
          </p>
        </div>
      </div>

      <div
        v-if="feedbackMessage"
        class="alert"
        :class="`alert-${feedbackType}`"
        :role="feedbackType === 'danger' ? 'alert' : 'status'"
        aria-live="polite"
      >
        {{ feedbackMessage }}
      </div>

      <div class="row g-4 mb-4">
        <div class="col-12 col-lg-4">
          <div class="card shadow-sm h-100 profile-card">
            <div class="card-body text-center">
              <i
                class="bi bi-person-circle profile-icon"
                aria-hidden="true"
              ></i>

              <h2 class="h4 mt-3 mb-1">
                {{ formattedUsername }}
              </h2>

              <p class="text-muted mb-2">
                Esploratore BioQuest
              </p>

              <p class="member-date mb-3">
                <i
                  class="bi bi-calendar3 me-1"
                  aria-hidden="true"
                ></i>
                Membro dal {{ memberSince }}
              </p>

              <section
                class="account-settings-box text-start"
                aria-labelledby="account-settings-title"
              >
                <div class="settings-header">
                  <h3
                    id="account-settings-title"
                    class="h6 mb-0 d-none d-lg-flex align-items-center"
                  >
                    <i
                      class="bi bi-gear me-2"
                      aria-hidden="true"
                    ></i>
                    Impostazioni account
                  </h3>

                  <button
                    class="profile-collapse-button d-lg-none"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#accountSettingsCollapse"
                    aria-expanded="false"
                    aria-controls="accountSettingsCollapse"
                  >
                    <span>
                      <i
                        class="bi bi-gear me-2"
                        aria-hidden="true"
                      ></i>
                      Impostazioni account
                    </span>

                    <i
                      class="bi bi-chevron-down collapse-icon"
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>

                <div
                  id="accountSettingsCollapse"
                  class="settings-panel collapse d-lg-block"
                >
                  <div class="settings-row">
                    <div class="settings-main">
                      <strong>Nome utente</strong>

                      <p class="mb-0 text-muted">
                        {{ username }}
                      </p>
                    </div>
                  </div>

                  <div class="settings-row">
                    <div class="settings-main">
                      <strong>Tema sito</strong>

                      <p class="mb-0 text-muted">
                        Scegli il tema oppure segui le impostazioni del dispositivo.
                      </p>
                    </div>

                    <select
                      v-model="themePreference"
                      class="form-select form-select-sm theme-select"
                      aria-label="Seleziona tema del sito"
                      @change="updateThemePreference"
                    >
                      <option value="light">Chiaro</option>
                      <option value="dark">Scuro</option>
                      <option value="system">Sistema</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-8">
          <div class="card shadow-sm h-100 summary-card">
            <div class="summary-header">
              <h2
                id="personal-summary-title"
                class="h5 card-title mb-0 d-none d-lg-block"
              >
                Riepilogo personale
              </h2>

              <button
                class="profile-collapse-button d-lg-none"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#personalSummaryCollapse"
                aria-expanded="false"
                aria-controls="personalSummaryCollapse"
              >
                <span>
                  <i
                    class="bi bi-bar-chart-line me-2"
                    aria-hidden="true"
                  ></i>
                  Riepilogo personale
                </span>

                <i
                  class="bi bi-chevron-down collapse-icon"
                  aria-hidden="true"
                ></i>
              </button>
            </div>

            <div
              id="personalSummaryCollapse"
              class="card-body collapse d-lg-block"
            >
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <div class="stat-box">
                    <small class="text-muted">
                      Preferiti salvati
                    </small>

                    <h3 class="mb-0">
                      {{ favoritesCount }}
                    </h3>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="stat-box">
                    <small class="text-muted">
                      Regno più rappresentato
                    </small>

                    <h3 class="h5 mb-0">
                      {{ mostRepresentedKingdom }}
                    </h3>
                  </div>
                </div>
              </div>

              <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap mt-4">
                <h2
                  id="statistics-title"
                  class="h5 mb-0"
                >
                  Regni nei preferiti
                </h2>
              </div>

              <div
                v-if="!hasChartData"
                class="alert alert-info mt-3 mb-0"
                role="status"
                aria-live="polite"
              >
                Salva almeno una specie nei preferiti per visualizzare il grafico.
              </div>

              <div
                v-else
                class="row g-3 align-items-center mt-1"
              >
                <div class="col-12 col-lg-7">
                  <div class="chart-container">
                    <canvas
                      ref="chartCanvas"
                      role="img"
                      aria-label="Grafico a torta con la percentuale dei regni salvati nei preferiti"
                    ></canvas>
                  </div>
                </div>

                <div class="col-12 col-lg-5">
                  <ul class="kingdom-list list-unstyled mb-0">
                    <li
                      v-for="item in kingdomPercentages"
                      :key="item.kingdom"
                      class="kingdom-list-item"
                    >
                      <span>{{ item.kingdom }}</span>
                      <strong>{{ item.percentage }}%</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section
        class="card shadow-sm favorites-section"
        aria-labelledby="favorites-title"
      >
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
            <div>
              <h2
                id="favorites-title"
                class="h5 card-title mb-1"
              >
                Preferiti
              </h2>

              <p class="text-muted mb-0">
                Specie salvate e avvistamenti preferiti.
              </p>
            </div>

            <span class="favorites-total-pill">
              {{ favoritesCount }} salvati
            </span>
          </div>

          <div
            v-if="favorites.length === 0"
            class="alert alert-info mb-0"
            role="status"
            aria-live="polite"
          >
            Non hai ancora salvato specie.
          </div>

          <div v-else>
            <section
              class="mb-4"
              aria-labelledby="species-favorites-title"
            >
              <div class="section-header-line">
                <h3
                  id="species-favorites-title"
                  class="h6 mb-0"
                >
                  Specie salvate
                </h3>

                <span>{{ speciesFavorites.length }}</span>
              </div>

              <div
                v-if="speciesFavorites.length === 0"
                class="empty-subsection"
                role="status"
              >
                Nessuna specie salvata senza dati di avvistamento.
              </div>

              <div
                v-else
                class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3"
              >
                <div
                  v-for="favorite in speciesFavorites"
                  :key="favorite.id"
                  class="col"
                >
                  <article
                    class="card h-100 shadow-sm favorite-card"
                    :aria-label="`Preferito ${getFavoriteName(favorite)}`"
                  >
                    <div class="card-body">
                      <h3 class="favorite-card-title">
                        {{ getFavoriteName(favorite) }}
                      </h3>

                      <p class="scientific-name mb-3">
                        <em>{{ favorite.scientificName || favorite.canonicalName || 'Nome scientifico non disponibile' }}</em>
                      </p>

                      <div
                        class="note-preview"
                        :class="{ empty: !hasFavoriteNote(favorite) }"
                      >
                        <span class="note-label">
                          Nota personale
                        </span>

                        <p class="mb-0">
                          {{ getFavoriteNote(favorite) }}
                        </p>
                      </div>
                    </div>

                    <div class="card-footer favorite-footer">
                      <button
                        class="btn btn-sm btn-outline-success"
                        type="button"
                        :aria-label="`Apri il dettaglio di ${getFavoriteName(favorite)}`"
                        @click="openFavoriteDetail(favorite)"
                      >
                        Dettagli
                      </button>

                      <button
                        class="btn btn-sm btn-outline-danger"
                        type="button"
                        :aria-label="`Rimuovi ${getFavoriteName(favorite)} dai preferiti`"
                        @click="openRemoveDialog(favorite)"
                      >
                        <i
                          class="bi bi-trash me-1"
                          aria-hidden="true"
                        ></i>
                        Rimuovi
                      </button>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section aria-labelledby="observation-favorites-title">
              <div class="section-header-line">
                <h3
                  id="observation-favorites-title"
                  class="h6 mb-0"
                >
                  Avvistamenti salvati
                </h3>

                <span>{{ observationFavorites.length }}</span>
              </div>

              <div
                v-if="observationFavorites.length === 0"
                class="empty-subsection"
                role="status"
              >
                Nessun avvistamento salvato nei preferiti.
              </div>

              <div
                v-else
                class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3"
              >
                <div
                  v-for="favorite in observationFavorites"
                  :key="favorite.id"
                  class="col"
                >
                  <article
                    class="card h-100 shadow-sm favorite-card observation-card"
                    :aria-label="`Avvistamento salvato di ${getFavoriteName(favorite)}`"
                  >
                    <img
                      v-if="favorite.observationImageUrl"
                      :src="favorite.observationImageUrl"
                      :alt="`Foto dell'avvistamento di ${getFavoriteName(favorite)}`"
                      class="favorite-image"
                    />

                    <div
                      v-else
                      class="favorite-image-placeholder"
                      aria-hidden="true"
                    >
                      <i class="bi bi-image"></i>
                    </div>

                    <div class="card-body">
                      <h3 class="favorite-card-title">
                        {{ getFavoriteName(favorite) }}
                      </h3>

                      <p class="scientific-name mb-3">
                        <em>{{ favorite.scientificName || favorite.canonicalName || 'Nome scientifico non disponibile' }}</em>
                      </p>

                      <div class="observation-info">
                        <p class="mb-1">
                          <strong>Luogo:</strong>
                          {{ getObservationLocation(favorite) }}
                        </p>

                        <p class="mb-1">
                          <strong>Paese:</strong>
                          {{ favorite.observationCountry || 'Non disponibile' }}
                        </p>

                        <p class="mb-0">
                          <strong>Data:</strong>
                          {{ favorite.observationDate || 'Non disponibile' }}
                        </p>
                      </div>

                      <div
                        class="note-preview mt-3"
                        :class="{ empty: !hasFavoriteNote(favorite) }"
                      >
                        <span class="note-label">
                          Nota personale
                        </span>

                        <p class="mb-0">
                          {{ getFavoriteNote(favorite) }}
                        </p>
                      </div>
                    </div>

                    <div class="card-footer favorite-footer">
                      <button
                        class="btn btn-sm btn-outline-success"
                        type="button"
                        :aria-label="`Apri il dettaglio dell'avvistamento di ${getFavoriteName(favorite)}`"
                        @click="openFavoriteDetail(favorite)"
                      >
                        Dettaglio
                      </button>

                      <button
                        class="btn btn-sm btn-outline-danger"
                        type="button"
                        :aria-label="`Rimuovi l'avvistamento di ${getFavoriteName(favorite)} dai preferiti`"
                        @click="openRemoveDialog(favorite)"
                      >
                        <i
                          class="bi bi-trash me-1"
                          aria-hidden="true"
                        ></i>
                        Rimuovi
                      </button>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </section>

    <div
      v-if="confirmDialogOpen"
      class="confirm-backdrop"
      role="presentation"
      @click.self="closeRemoveDialog"
    >
      <section
        class="confirm-dialog"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="remove-dialog-title"
        aria-describedby="remove-dialog-description"
      >
        <div class="confirm-icon">
          <i
            class="bi bi-exclamation-triangle"
            aria-hidden="true"
          ></i>
        </div>

        <h2
          id="remove-dialog-title"
          class="h5 fw-bold mb-2"
        >
          Eliminare il preferito?
        </h2>

        <p
          id="remove-dialog-description"
          class="text-muted mb-4"
        >
          Sei sicuro di voler eliminare
          <strong>{{ favoriteToRemove ? getFavoriteName(favoriteToRemove) : 'questo preferito' }}</strong>
          dalla tua raccolta?
        </p>

        <div class="d-flex justify-content-end gap-2">
          <button
            class="btn btn-outline-secondary"
            type="button"
            :disabled="isRemovingFavorite"
            @click="closeRemoveDialog"
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
.profile-page {
  color: var(--bioquest-text, #1b1f23);
}

.section-kicker {
  color: var(--bioquest-primary, #00bd7e);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-card,
.summary-card,
.favorites-section {
  overflow: hidden;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.16));
  border-radius: 1rem;
  background-color: var(--bioquest-surface, #ffffff);
}

.profile-icon {
  color: var(--bioquest-primary, #00bd7e);
  font-size: 4rem;
}

.member-date {
  color: var(--bioquest-primary-dark, #2d6a4f);
  font-size: 0.9rem;
  font-weight: 600;
}

.account-settings-box {
  margin-top: 1rem;
  overflow: hidden;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.2));
  border-radius: 0.85rem;
  background-color: var(--bioquest-surface, #ffffff);
}

.settings-header,
.summary-header {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.16));
  color: var(--bioquest-primary-dark, #1b4332);
  background-color: var(--bioquest-surface, #ffffff);
}

.settings-panel {
  padding: 0 1rem 1rem;
  background-color: var(--bioquest-surface, #ffffff);
}

.summary-card > .card-body {
  background-color: var(--bioquest-surface, #ffffff);
}

.profile-collapse-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  border: 0;
  color: var(--bioquest-primary-dark, #1b4332);
  background-color: transparent;
  font-weight: 700;
  text-align: left;
}

.profile-collapse-button span {
  display: inline-flex;
  align-items: center;
}

.collapse-icon {
  color: var(--bioquest-primary, #00bd7e);
  transition: transform 0.2s ease;
}

.profile-collapse-button[aria-expanded="true"] .collapse-icon {
  transform: rotate(180deg);
}

.settings-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.12));
}

.settings-row:last-of-type {
  border-bottom: 0;
}

.settings-main {
  flex: 1;
  min-width: 0;
}

.theme-select {
  max-width: 9rem;
}

.stat-box {
  min-height: 100%;
  padding: 1rem;
  border: 1px solid var(--bioquest-border, #d8f3dc);
  border-radius: 0.75rem;
  background-color: var(--bioquest-surface-soft, #f8fff8);
}

.stat-box h3,
.stat-box h5 {
  color: var(--bioquest-primary-dark, #1b4332);
}

.chart-badge,
.favorites-total-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  color: var(--bioquest-primary-dark, #1b4332);
  background-color: rgba(0, 189, 126, 0.14);
  font-size: 0.85rem;
  font-weight: 700;
}

.chart-container {
  height: 320px;
}

.kingdom-list {
  overflow: hidden;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.16));
  border-radius: 0.85rem;
}

.kingdom-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.12));
  background-color: var(--bioquest-surface, #ffffff);
}

.kingdom-list-item:last-child {
  border-bottom: 0;
}

.kingdom-list-item strong {
  color: var(--bioquest-primary, #00bd7e);
}

.section-header-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.18));
}

.section-header-line h3 {
  color: var(--bioquest-primary-dark, #1b4332);
  font-weight: 700;
}

.section-header-line span {
  display: inline-flex;
  justify-content: center;
  min-width: 2rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  color: var(--bioquest-primary-dark, #1b4332);
  background-color: rgba(0, 189, 126, 0.12);
  font-size: 0.85rem;
  font-weight: 700;
}

.empty-subsection {
  padding: 1rem;
  border: 1px dashed var(--bioquest-border-strong, rgba(0, 189, 126, 0.25));
  border-radius: 0.85rem;
  color: var(--bioquest-muted, #6c757d);
  background-color: var(--bioquest-surface-soft, #f8fff8);
}

.favorite-card {
  overflow: hidden;
  border-color: var(--bioquest-border, #d8f3dc);
  border-radius: 0.95rem;
}

.favorite-card:hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

.favorite-card-title {
  margin-bottom: 0.25rem;
  color: var(--bioquest-primary-dark, #1b4332);
  font-size: 1.08rem;
  font-weight: 700;
}

.favorite-image,
.favorite-image-placeholder {
  width: 100%;
  height: 155px;
}

.favorite-image {
  object-fit: cover;
}

.favorite-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bioquest-primary, #00bd7e);
  background-color: rgba(0, 189, 126, 0.1);
  font-size: 2rem;
}

.scientific-name {
  color: var(--bioquest-muted, #6c757d);
  font-size: 0.9rem;
}

.note-preview {
  padding: 0.8rem;
  border: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.16));
  border-radius: 0.75rem;
  color: var(--bioquest-primary-dark, #1b4332);
  background-color: var(--bioquest-surface-soft, #f8fff8);
  font-size: 0.92rem;
}

.note-preview.empty {
  color: var(--bioquest-muted, #6c757d);
  background-color: var(--bioquest-surface, #ffffff);
}

.note-label {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--bioquest-primary, #00bd7e);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.favorite-footer {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  border-top: 1px solid var(--bioquest-border, rgba(0, 189, 126, 0.14));
  background-color: var(--bioquest-surface, #ffffff);
}

.observation-info {
  padding: 0.75rem;
  border: 1px solid var(--bioquest-border, #d8f3dc);
  border-radius: 0.75rem;
  background-color: var(--bioquest-surface, #ffffff);
  font-size: 0.9rem;
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

@media (min-width: 992px) {
  .summary-header {
    padding: 1rem 1rem 0;
    border-bottom: 0;
    background-color: var(--bioquest-surface, #ffffff);
  }
}

@media (max-width: 991px) {
  .profile-card,
  .summary-card {
    background-color: var(--bioquest-surface, #ffffff);
  }

  .settings-header,
  .summary-header {
    background-color: var(--bioquest-surface, #ffffff);
  }

  .settings-panel {
    padding: 0 1rem 1rem;
    background-color: var(--bioquest-surface, #ffffff);
  }

  .summary-card > .card-body {
    padding-top: 1rem;
    background-color: var(--bioquest-surface, #ffffff);
  }
}

@media (max-width: 576px) {
  .favorite-footer {
    flex-direction: column;
  }

  .favorite-footer .btn {
    width: 100%;
  }

  .settings-row {
    align-items: stretch;
    flex-direction: column;
  }

  .theme-select {
    max-width: 100%;
  }
}
</style>