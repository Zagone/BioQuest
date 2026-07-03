// Router principale BioQuest con pagine esplorative pubbliche e profilo protetto
import { createRouter, createWebHistory } from 'vue-router'

import LoginView from '../views/LoginView.vue'
import HomeView from '../views/HomeView.vue'
import SpeciesDetailView from '../views/SpeciesDetailView.vue'
import MapView from '../views/MapView.vue'
import ProfileView from '../views/ProfileView.vue'

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'home',
    component: HomeView
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView
  },
  {
    path: '/species/:id',
    name: 'species-detail',
    component: SpeciesDetailView
  },
  {
    path: '/map',
    name: 'map',
    component: MapView
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/home'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const loggedUser = localStorage.getItem('bioquestUser')

  if (to.meta.requiresAuth && !loggedUser) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    }
  }

  return true
})

export default router