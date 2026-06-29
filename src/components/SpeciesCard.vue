<!-- Card riutilizzabile per mostrare una specie e gestire i preferiti con supporto ARIA -->
<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  species: Object,
  isFavorite: Boolean
})

const emit = defineEmits(['toggleFavorite'])

const router = useRouter()

function openDetails() {
  if (!props.species?.key) return

  router.push(`/species/${props.species.key}`)
}

function handleFavoriteClick() {
  emit('toggleFavorite', props.species)
}
</script>

<template>
  <div
    class="card species-card h-100"
    :aria-label="`Scheda specie ${species.scientificName}`"
  >
    <div class="card-body position-relative d-flex flex-column">

      <button
        class="favorite-button"
        type="button"
        :class="{ active: isFavorite }"
        :aria-label="isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
        @click="handleFavoriteClick"
      >
        <i
          v-if="isFavorite"
          class="bi bi-star-fill"
          aria-hidden="true"
        ></i>

        <i
          v-else
          class="bi bi-star"
          aria-hidden="true"
        ></i>
      </button>

      <p class="species-rank mb-2">
        {{ species.rank || 'Non disponibile' }}
      </p>

      <h5 class="card-title pe-4">
        {{ species.scientificName }}
      </h5>

      <div
        class="species-info mt-3"
        aria-label="Informazioni tassonomiche principali"
      >
        <p>
          <span>Regno</span>
          <strong>{{ species.kingdom || 'Non disponibile' }}</strong>
        </p>

        <p>
          <span>Famiglia</span>
          <strong>{{ species.family || 'Non disponibile' }}</strong>
        </p>
      </div>

      <button
        class="btn btn-outline-success w-100 mt-auto"
        type="button"
        :aria-label="`Apri dettagli di ${species.scientificName}`"
        @click="openDetails"
      >
        <i
          class="bi bi-arrow-right-circle me-1"
          aria-hidden="true"
        ></i>
        Dettagli
      </button>

    </div>
  </div>
</template>

<style scoped>
.species-card {
  border: 1px solid #d8f3dc;
  border-radius: 1rem;
  box-shadow: 0 0.25rem 0.75rem rgba(45, 106, 79, 0.08);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.species-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0.75rem 1.5rem rgba(45, 106, 79, 0.16);
}

.favorite-button {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  border: none;
  background: #f8fff8;
  color: #2d6a4f;
  border-radius: 999px;
  width: 2.25rem;
  height: 2.25rem;
  cursor: pointer;
}

.favorite-button.active {
  color: #ffc107;
}

.species-rank {
  width: fit-content;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  color: #2d6a4f;
  background-color: #d8f3dc;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.card-title {
  min-height: 3.5rem;
  color: #1b4332;
}

.species-info p {
  margin-bottom: 0.75rem;
}

.species-info span {
  display: block;
  color: #6c757d;
  font-size: 0.8rem;
}

.species-info strong {
  color: #212529;
}
</style>