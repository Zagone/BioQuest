// Configurazione delle rotte principali dell'app BioQuest

import { createRouter, createWebHistory } from 'vue-router'

import LoginView from '../views/LoginView.vue'
import HomeView from '../views/HomeView.vue'
import SpeciesDetailView from '../views/SpeciesDetailView.vue'
import ProfileView from '../views/ProfileView.vue'
import MapView from '../views/MapView.vue'

function requireLogin() {
  const user = localStorage.getItem('bioquestUser')

  if (!user) {
    return { name: 'login' }
  }

  return true
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView,
      beforeEnter: requireLogin
    },
    {
      path: '/species/:id',
      name: 'species',
      component: SpeciesDetailView,
      beforeEnter: requireLogin
    },
    {
      path: '/map',
      name: 'map',
      component: MapView,
      beforeEnter: requireLogin
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      beforeEnter: requireLogin
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' }
    }
  ]
})

export default router