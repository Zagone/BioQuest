<!-- Login e registrazione simulati: controllano solo l'esistenza dello username su Firestore con supporto ARIA -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const router = useRouter()

const username = ref('')
const password = ref('')
const isRegisterMode = ref(false)
const message = ref('')
const messageType = ref('info')

function normalizeUsername(value) {
  return value.trim().toLowerCase()
}

function createDisplayName(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Pulisce gli stati temporanei salvati durante la navigazione
function clearNavigationState() {
  sessionStorage.removeItem('bioquestHomeState')
  sessionStorage.removeItem('bioquestMapState')
  sessionStorage.removeItem('bioquestSelectedObservation')
}

function toggleMode() {
  isRegisterMode.value = !isRegisterMode.value
  message.value = ''
}

async function login() {
  const cleanUsername = normalizeUsername(username.value)

  if (!cleanUsername) {
    messageType.value = 'danger'
    message.value = 'Inserisci uno username'
    return
  }

  const userRef = doc(db, 'users', cleanUsername)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    messageType.value = 'danger'
    message.value = 'Utente non registrato. Registrati prima di accedere.'
    return
  }

  clearNavigationState()
  localStorage.setItem('bioquestUser', cleanUsername)
  router.push('/home')
}

async function register() {
  const cleanUsername = normalizeUsername(username.value)
  
  if (!cleanUsername) {
    messageType.value = 'danger'
    message.value = 'Inserisci uno username'
    return
  }

  const userRef = doc(db, 'users', cleanUsername)
  const userSnap = await getDoc(userRef)

  if (userSnap.exists()) {
    messageType.value = 'danger'
    message.value = 'Username già registrato. Prova ad accedere.'
    return
  }

  await setDoc(userRef, {
    username: cleanUsername,
    displayName: createDisplayName(cleanUsername),
    createdAt: new Date().toISOString()
  })

  clearNavigationState()

  messageType.value = 'success'
  message.value = 'Registrazione completata. Ora puoi accedere.'
  isRegisterMode.value = false
}
</script>

<template>
  <main class="min-vh-100 d-flex align-items-center bg-light">
    <section
      class="container"
      aria-labelledby="login-title"
    >
      <div class="row justify-content-center">
        <div class="col-12 col-md-8 col-lg-5">

          <div class="card shadow-sm border-0">
            <div class="card-body p-4 p-md-5">

              <div class="text-center mb-4">
                <i
                  class="bi bi-tree"
                  style="font-size: 3rem;"
                  aria-hidden="true"
                ></i>

                <h1
                  id="login-title"
                  class="fw-bold mt-2"
                >
                  BioQuest
                </h1>

                <p class="text-muted">
                  Esplora la biodiversità globale
                </p>
              </div>

              <h2
                id="auth-form-title"
                class="h4 mb-3"
              >
                {{ isRegisterMode ? 'Registrati' : 'Accedi' }}
              </h2>

              <form
                aria-labelledby="auth-form-title"
                @submit.prevent="isRegisterMode ? register() : login()"
              >
                <div class="mb-3">
                  <label
                    for="username"
                    class="form-label"
                  >
                    Username
                  </label>

                  <input
                    id="username"
                    v-model="username"
                    class="form-control"
                    type="text"
                    placeholder="es. lorenzo"
                    autocomplete="username"
                    aria-describedby="username-help"
                  />

                  <small
                    id="username-help"
                    class="text-muted"
                  >
                    Inserisci lo username usato per accedere al profilo.
                  </small>
                </div>

                <div class="mb-3">
                  <label
                    for="password"
                    class="form-label"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    v-model="password"
                    class="form-control"
                    type="password"
                    placeholder="password qualsiasi"
                    autocomplete="current-password"
                    aria-describedby="password-help"
                  />

                  <small
                    id="password-help"
                    class="text-muted"
                  >
                    La password non viene controllata: conta solo lo username.
                  </small>
                </div>

                <div
                  v-if="message"
                  class="alert"
                  :class="`alert-${messageType}`"
                  :role="messageType === 'danger' ? 'alert' : 'status'"
                  :aria-live="messageType === 'danger' ? 'assertive' : 'polite'"
                >
                  {{ message }}
                </div>

                <button
                  v-if="!isRegisterMode"
                  class="btn btn-primary w-100 mb-3"
                  type="submit"
                  aria-label="Accedi al profilo BioQuest"
                >
                  Accedi
                </button>

                <button
                  v-else
                  class="btn btn-success w-100 mb-3"
                  type="submit"
                  aria-label="Crea un nuovo profilo BioQuest"
                >
                  Crea profilo
                </button>
              </form>

              <button
                class="btn btn-link w-100"
                type="button"
                :aria-label="isRegisterMode ? 'Passa alla modalità di accesso' : 'Passa alla modalità di registrazione'"
                @click="toggleMode"
              >
                {{ isRegisterMode ? 'Hai già un profilo? Accedi' : 'Non hai un profilo? Registrati' }}
              </button>

            </div>
          </div>

        </div>
      </div>
    </section>
  </main>
</template>