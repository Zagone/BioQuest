<!-- Card riutilizzabile per mostrare una specie e gestire i preferiti con supporto ARIA -->
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  species: Object,
  isFavorite: Boolean
})

const emit = defineEmits(['toggleFavorite'])

const router = useRouter()

const speciesName = computed(() => {
  return (
    props.species?.scientificName ||
    props.species?.canonicalName ||
    props.species?.vernacularName ||
    'specie non disponibile'
  )
})

function openDetails() {
  if (!props.species?.key) return

  router.push(`/species/${props.species.key}`)
}

function handleFavoriteClick() {
  emit('toggleFavorite', props.species)
}
</script>

<template>
  <article
    class="card species-card h-100"
    :aria-label="`Scheda specie ${speciesName}`"
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
          :class="isFavorite ? 'bi bi-heart-fill' : 'bi bi-heart'"
          aria-hidden="true"
        ></i>
      </button>

      <p class="species-rank mb-2">
        {{ species.rank || 'Non disponibile' }}
      </p>

      <h5 class="card-title pe-4">
        {{ speciesName }}
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
        :aria-label="`Apri dettagli di ${speciesName}`"
        @click="openDetails"
      >
        Dettagli
      </button>
    </div>
  </article>
</template>

<style scoped>
.species-card {
  border: 1px solid var(--bioquest-border, #d8f3dc);
  border-radius: 1rem;
  background-color: var(--bioquest-surface, #ffffff);
  color: var(--bioquest-text, #1b4332);
  box-shadow: 0 0.25rem 0.75rem rgba(45, 106, 79, 0.08);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.species-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0.75rem 1.5rem rgba(45, 106, 79, 0.16);
}

.favorite-button {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--bioquest-border, #d8f3dc);
  border-radius: 999px;
  background-color: var(--bioquest-surface-soft, #f8fff8);
  color: var(--bioquest-primary-medium, #2d6a4f);
  cursor: pointer;
}

.favorite-button:hover,
.favorite-button:focus {
  background-color: var(--bioquest-primary-soft, rgba(0, 189, 126, 0.14));
  color: var(--bioquest-primary-dark, #1b4332);
}

.favorite-button:focus-visible {
  outline: 3px solid rgba(0, 189, 126, 0.35);
  outline-offset: 3px;
}

.favorite-button.active {
  color: var(--bioquest-primary-medium, #2d6a4f);
}

.species-rank {
  width: fit-content;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  color: var(--bioquest-primary-dark, #2d6a4f);
  background-color: var(--bioquest-primary-soft, #d8f3dc);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.card-title {
  min-height: 3.5rem;
  color: var(--bioquest-heading, #1b4332);
}

.species-info p {
  margin-bottom: 0.75rem;
}

.species-info span {
  display: block;
  color: var(--bioquest-muted, #6c757d);
  font-size: 0.8rem;
}

.species-info strong {
  color: var(--bioquest-text, #212529);
}

:global(html[data-theme='dark']) .species-card {
  box-shadow: 0 0.45rem 1.15rem rgba(0, 0, 0, 0.25);
}

:global(html[data-theme='dark']) .species-card:hover {
  box-shadow: 0 0.9rem 1.7rem rgba(0, 0, 0, 0.36);
}
</style>