<!-- Login e registrazione simulati con username e password su Firestore -->
<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import AppNavbar from '../components/AppNavbar.vue'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const isRegisterMode = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const message = ref('')
const messageType = ref('info')

function normalizeUsername(value) {
  return value.trim().toLowerCase()
}

function createDisplayName(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getRedirectPath() {
  const redirect = route.query.redirect

  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return redirect
  }

  return '/home'
}

function clearNavigationState() {
  sessionStorage.removeItem('bioquestHomeState')
  sessionStorage.removeItem('bioquestMapState')
  sessionStorage.removeItem('bioquestSelectedObservation')
}

function showMessage(type, text) {
  messageType.value = type
  message.value = text
}

function toggleMode() {
  isRegisterMode.value = !isRegisterMode.value
  message.value = ''
  password.value = ''
  confirmPassword.value = ''
  showPassword.value = false
  showConfirmPassword.value = false
}

async function login() {
  const cleanUsername = normalizeUsername(username.value)

  if (!cleanUsername || !password.value) {
    showMessage('danger', 'Inserisci username e password.')
    return
  }

  try {
    const userRef = doc(db, 'users', cleanUsername)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      showMessage('danger', 'Utente non registrato.')
      return
    }

    const userData = userSnap.data()

    if (userData.password !== password.value) {
      showMessage('danger', 'Password non corretta.')
      return
    }

    clearNavigationState()
    localStorage.setItem('bioquestUser', cleanUsername)
    window.dispatchEvent(new Event('bioquest-auth-changed'))
    router.push(getRedirectPath())
  } catch (error) {
    showMessage('danger', 'Errore durante l’accesso. Riprova tra qualche secondo.')
  }
}

async function register() {
  const cleanUsername = normalizeUsername(username.value)

  if (!cleanUsername || !password.value || !confirmPassword.value) {
    showMessage('danger', 'Compila tutti i campi.')
    return
  }

  if (password.value !== confirmPassword.value) {
    showMessage('danger', 'Le password non coincidono.')
    return
  }

  try {
    const userRef = doc(db, 'users', cleanUsername)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      showMessage('danger', 'Username già registrato. Prova ad accedere.')
      return
    }

    await setDoc(userRef, {
      username: cleanUsername,
      displayName: createDisplayName(cleanUsername),
      password: password.value,
      createdAt: new Date().toISOString()
    })

    clearNavigationState()
    localStorage.setItem('bioquestUser', cleanUsername)
    window.dispatchEvent(new Event('bioquest-auth-changed'))
    router.push(getRedirectPath())
  } catch (error) {
    showMessage('danger', 'Errore durante la registrazione. Riprova tra qualche secondo.')
  }
}

</script>

<template>
  <main>
    <AppNavbar />

    <section
      class="login-page d-flex align-items-center"
      aria-labelledby="login-title"
    >
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-12 col-md-8 col-lg-5">
            <div class="login-card">
              <div class="text-center mb-4">
                <i
                  class="bi bi-tree-fill login-icon"
                  aria-hidden="true"
                ></i>

                <h1
                  id="login-title"
                  class="fw-bold mt-2 mb-1"
                >
                  BioQuest
                </h1>

                <p class="text-muted mb-0">
                  Accedi per salvare preferiti e note personali
                </p>
              </div>

              <h2 class="h4 fw-bold mb-3">
                {{ isRegisterMode ? 'Registrati' : 'Accedi' }}
              </h2>

              <form @submit.prevent="isRegisterMode ? register() : login()">
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
                  />
                </div>

                <div class="mb-3">
                  <label
                    for="password"
                    class="form-label"
                  >
                    Password
                  </label>

                  <div class="password-field">
                    <input
                      id="password"
                      v-model="password"
                      class="form-control password-input"
                      :type="showPassword ? 'text' : 'password'"
                      placeholder="Inserisci password"
                      :autocomplete="isRegisterMode ? 'new-password' : 'current-password'"
                    />

                    <button
                      class="password-toggle"
                      type="button"
                      :aria-label="showPassword ? 'Nascondi password' : 'Mostra password'"
                      @click="showPassword = !showPassword"
                    >
                      <i
                        :class="showPassword ? 'bi bi-eye' : 'bi bi-eye-slash'"
                        aria-hidden="true"
                      ></i>
                    </button>
                  </div>
                </div>

                <div
                  v-if="isRegisterMode"
                  class="mb-3"
                >
                  <label
                    for="confirm-password"
                    class="form-label"
                  >
                    Conferma password
                  </label>

                  <div class="password-field">
                    <input
                      id="confirm-password"
                      v-model="confirmPassword"
                      class="form-control password-input"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      placeholder="Ripeti password"
                      autocomplete="new-password"
                    />

                    <button
                      class="password-toggle"
                      type="button"
                      :aria-label="showConfirmPassword ? 'Nascondi conferma password' : 'Mostra conferma password'"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <i
                        :class="showConfirmPassword ? 'bi bi-eye' : 'bi bi-eye-slash'"
                        aria-hidden="true"
                      ></i>
                    </button>
                  </div>
                </div>

                <div
                  v-if="message"
                  class="alert"
                  :class="`alert-${messageType}`"
                  :role="messageType === 'danger' ? 'alert' : 'status'"
                >
                  {{ message }}
                </div>

                <button
                  class="btn btn-success w-100"
                  type="submit"
                >
                  {{ isRegisterMode ? 'Crea profilo' : 'Accedi' }}
                </button>
              </form>

              <button
                class="btn btn-link w-100 mt-3 switch-link"
                type="button"
                @click="toggleMode"
              >
                {{
                  isRegisterMode
                    ? 'Hai già un profilo? Accedi'
                    : 'Non hai un profilo? Registrati'
                }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - 64px);
  background-color: #f8fff8;
}

.login-card {
  padding: 2rem;
  border: 1px solid #d8f3dc;
  border-radius: 1.25rem;
  background-color: #ffffff;
  box-shadow: 0 0.75rem 1.75rem rgba(27, 67, 50, 0.08);
}

.login-icon {
  color: #2d6a4f;
  font-size: 3rem;
}

.form-label {
  color: #1b4332;
  font-weight: 600;
}

.password-field {
  position: relative;
}

.password-input {
  padding-right: 3rem;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  color: #52796f;
  background-color: transparent;
  transform: translateY(-50%);
}

.password-toggle:hover {
  color: #1b4332;
}

.switch-link {
  color: #2d6a4f;
  font-weight: 600;
  text-decoration: none;
}

.switch-link:hover {
  color: #1b4332;
  text-decoration: underline;
}

@media (max-width: 575px) {
  .login-card {
    padding: 1.5rem;
  }
}
</style>