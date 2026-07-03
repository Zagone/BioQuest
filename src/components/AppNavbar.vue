<!-- Navbar responsive Bootstrap con dialog di conferma logout -->
<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const loggedUser = ref(localStorage.getItem('bioquestUser'))
const logoutDialogOpen = ref(false)
const isLoggingOut = ref(false)
const logoutDialogRef = ref(null)

let lastFocusedElement = null

function updateLoggedUser() {
  loggedUser.value = localStorage.getItem('bioquestUser')
}

function clearNavigationState() {
  sessionStorage.removeItem('bioquestHomeState')
  sessionStorage.removeItem('bioquestMapState')
  sessionStorage.removeItem('bioquestSelectedObservation')
}

function clearSelectedObservation() {
  sessionStorage.removeItem('bioquestSelectedObservation')
}

function isCurrentRoute(routeName) {
  return route.name === routeName
}

function goHome() {
  sessionStorage.removeItem('bioquestHomeState')
  clearSelectedObservation()
  router.push('/home')
}

function goMap() {
  clearSelectedObservation()
  router.push('/map')
}

function goProfile() {
  clearSelectedObservation()
  router.push('/profile')
}

function goLogin() {
  clearSelectedObservation()
  router.push('/login')
}

async function openLogoutDialog() {
  lastFocusedElement = document.activeElement
  logoutDialogOpen.value = true

  await nextTick()

  logoutDialogRef.value?.focus()
}

function closeLogoutDialog() {
  if (isLoggingOut.value) return

  logoutDialogOpen.value = false

  if (lastFocusedElement) {
    lastFocusedElement.focus()
    lastFocusedElement = null
  }
}

function trapLogoutDialogFocus(event) {
  if (!logoutDialogOpen.value || event.key !== 'Tab') return

  const focusableElements = logoutDialogRef.value?.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )

  if (!focusableElements || focusableElements.length === 0) {
    event.preventDefault()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

function confirmLogout() {
  isLoggingOut.value = true

  clearNavigationState()
  localStorage.removeItem('bioquestUser')
  updateLoggedUser()

  window.dispatchEvent(new Event('bioquest-auth-changed'))
  window.dispatchEvent(new Event('bioquest-user-reset'))

  logoutDialogOpen.value = false
  isLoggingOut.value = false

  router.replace('/home')
}

onMounted(() => {
  updateLoggedUser()
  window.addEventListener('bioquest-auth-changed', updateLoggedUser)
})

onBeforeUnmount(() => {
  window.removeEventListener('bioquest-auth-changed', updateLoggedUser)
})
</script>

<template>
  <nav
    class="navbar navbar-expand-md bio-navbar"
    aria-label="Navigazione principale"
  >
    <div class="bio-navbar-container">
      <button
        class="navbar-brand btn btn-link text-decoration-none fw-bold p-0"
        type="button"
        aria-label="Vai alla home di BioQuest"
        @click="goHome"
      >
        <i
          class="bi bi-tree-fill me-2"
          aria-hidden="true"
        ></i>
        BioQuest
      </button>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#bioquestNavbar"
        aria-controls="bioquestNavbar"
        aria-expanded="false"
        aria-label="Apri menu di navigazione"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div
        id="bioquestNavbar"
        class="collapse navbar-collapse"
      >
        <div class="navbar-nav ms-auto gap-md-2">
          <button
            class="nav-link btn btn-link text-start"
            type="button"
            aria-label="Vai alla pagina Home"
            :aria-current="isCurrentRoute('home') ? 'page' : undefined"
            @click="goHome"
          >
            <i
              class="bi bi-house-door me-1"
              aria-hidden="true"
            ></i>
            Home
          </button>

          <button
            class="nav-link btn btn-link text-start"
            type="button"
            aria-label="Vai alla pagina Mappa"
            :aria-current="isCurrentRoute('map') ? 'page' : undefined"
            @click="goMap"
          >
            <i
              class="bi bi-geo-alt me-1"
              aria-hidden="true"
            ></i>
            Mappa
          </button>

          <button
            v-if="loggedUser"
            class="nav-link btn btn-link text-start"
            type="button"
            aria-label="Vai alla pagina Profilo"
            :aria-current="isCurrentRoute('profile') ? 'page' : undefined"
            @click="goProfile"
          >
            <i
              class="bi bi-person me-1"
              aria-hidden="true"
            ></i>
            Profilo
          </button>

          <button
            v-if="loggedUser"
            class="nav-link btn btn-link text-start logout-link"
            type="button"
            aria-label="Esci dal profilo"
            @click="openLogoutDialog"
          >
            <i
              class="bi bi-box-arrow-right me-1"
              aria-hidden="true"
            ></i>
            Esci
          </button>

          <button
            v-else
            class="nav-link btn btn-link text-start"
            type="button"
            aria-label="Vai alla pagina di accesso"
            :aria-current="isCurrentRoute('login') ? 'page' : undefined"
            @click="goLogin"
          >
            <i
              class="bi bi-box-arrow-in-right me-1"
              aria-hidden="true"
            ></i>
            Accedi
          </button>
        </div>
      </div>
    </div>
  </nav>

  <div
    v-if="logoutDialogOpen"
    class="confirm-backdrop"
    role="presentation"
    @click.self="closeLogoutDialog"
  >
    <section
      ref="logoutDialogRef"
      class="confirm-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="logout-dialog-title"
      aria-describedby="logout-dialog-description"
      @keydown="trapLogoutDialogFocus"
    >
      <div class="confirm-icon">
        <i
          class="bi bi-box-arrow-right"
          aria-hidden="true"
        ></i>
      </div>

      <h2
        id="logout-dialog-title"
        class="h5 fw-bold mb-2"
      >
        Uscire dal profilo?
      </h2>

      <p
        id="logout-dialog-description"
        class="text-muted mb-4"
      >
        Verrà chiusa la sessione corrente e tornerai alla Home.
      </p>

      <div class="d-flex justify-content-end gap-2">
        <button
          class="btn btn-outline-secondary"
          type="button"
          :disabled="isLoggingOut"
          @click="closeLogoutDialog"
        >
          Annulla
        </button>

        <button
          class="btn btn-danger"
          type="button"
          :disabled="isLoggingOut"
          @click="confirmLogout"
        >
          <span
            v-if="isLoggingOut"
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          ></span>
          Esci
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.bio-navbar {
  background-color: #2d6a4f;
  border-bottom: 1px solid #1b4332;
}

.bio-navbar-container {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0.65rem 1.5rem;
}

.navbar-collapse {
  flex-grow: 1;
}

.navbar-nav {
  margin-left: auto;
}

.navbar-brand {
  color: #ffffff;
}

.navbar-brand:hover,
.navbar-brand:focus {
  color: #d8f3dc;
}

.nav-link {
  padding-inline: 0.75rem;
  border-radius: 0.5rem;
  color: #f8fff8;
}

.nav-link:hover,
.nav-link:focus {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.12);
}

.nav-link[aria-current="page"] {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.18);
  font-weight: 600;
}

.logout-link:hover,
.logout-link:focus {
  background-color: rgba(255, 255, 255, 0.18);
}

.navbar-toggler {
  border-color: rgba(255, 255, 255, 0.4);
}

.navbar-toggler-icon {
  filter: invert(1);
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

@media (max-width: 767.98px) {
  .bio-navbar-container {
    flex-wrap: wrap;
    padding-inline: 1rem;
  }

  .navbar-toggler {
    margin-left: auto;
  }

  .navbar-collapse {
    width: 100%;
  }

  .navbar-nav {
    padding-top: 0.75rem;
    margin-left: 0;
  }

  .nav-link {
    padding-block: 0.65rem;
  }
}
</style>