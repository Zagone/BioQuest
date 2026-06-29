<!-- Navbar responsive Bootstrap in stile bio-naturalista con supporto ARIA -->
<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

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

function logout() {
  clearNavigationState()
  localStorage.removeItem('bioquestUser')
  router.push('/')
}
</script>

<template>
  <nav
    class="navbar navbar-expand-md bio-navbar"
    aria-label="Navigazione principale"
  >
    <div class="container">
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
            class="nav-link btn btn-link text-start logout-link"
            type="button"
            aria-label="Esci dal profilo"
            @click="logout"
          >
            <i
              class="bi bi-box-arrow-right me-1"
              aria-hidden="true"
            ></i>
            Logout
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.bio-navbar {
  background-color: #2d6a4f;
  border-bottom: 1px solid #1b4332;
}

.navbar-brand {
  color: #ffffff;
}

.navbar-brand:hover {
  color: #d8f3dc;
}

.nav-link {
  color: #f8fff8;
  border-radius: 0.5rem;
  padding-inline: 0.75rem;
}

.nav-link:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.12);
}

.nav-link[aria-current="page"] {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.18);
  font-weight: 600;
}

.logout-link:hover {
  background-color: rgba(255, 255, 255, 0.18);
}

.navbar-toggler {
  border-color: rgba(255, 255, 255, 0.4);
}

.navbar-toggler-icon {
  filter: invert(1);
}
</style>