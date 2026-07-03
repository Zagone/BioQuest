<!-- Toast riutilizzabile per mostrare feedback temporanei all'utente -->
<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info'
  },
  duration: {
    type: Number,
    default: 3000
  }
})

const emit = defineEmits(['close'])

let timer = null

const toastClass = computed(() => {
  return {
    'toast-success': props.type === 'success',
    'toast-error': props.type === 'error',
    'toast-warning': props.type === 'warning',
    'toast-info': props.type === 'info'
  }
})

const iconClass = computed(() => {
  if (props.type === 'success') return 'bi bi-check-circle-fill'
  if (props.type === 'error') return 'bi bi-x-circle-fill'
  if (props.type === 'warning') return 'bi bi-exclamation-triangle-fill'

  return 'bi bi-info-circle-fill'
})

function clearToastTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function closeToast() {
  clearToastTimer()
  emit('close')
}

watch(
  () => props.show,
  (isVisible) => {
    clearToastTimer()

    if (isVisible) {
      timer = setTimeout(() => {
        emit('close')
      }, props.duration)
    }
  }
)

onBeforeUnmount(() => {
  clearToastTimer()
})
</script>

<template>
  <Transition name="toast-slide">
    <div
      v-if="show && message"
      class="app-toast"
      :class="toastClass"
      role="status"
      aria-live="polite"
    >
      <i
        :class="iconClass"
        aria-hidden="true"
      ></i>

      <span class="toast-message">
        {{ message }}
      </span>

      <button
        class="toast-close"
        type="button"
        aria-label="Chiudi messaggio"
        @click="closeToast"
      >
        <i
          class="bi bi-x-lg"
          aria-hidden="true"
        ></i>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.app-toast {
  position: fixed;
  top: 5.25rem;
  right: 1.25rem;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: min(92vw, 430px);
  padding: 0.95rem 1rem;
  border: 1px solid var(--bioquest-border, transparent);
  border-radius: 1rem;
  color: var(--bioquest-text, #1b1f23);
  background-color: var(--bioquest-surface, #ffffff);
  box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.18);
}

.app-toast i {
  flex: 0 0 auto;
  font-size: 1.25rem;
}

.toast-message {
  flex: 1;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.35;
}

.toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 50%;
  color: inherit;
  background-color: transparent;
}

.toast-close:hover,
.toast-close:focus {
  background-color: rgba(0, 0, 0, 0.08);
}

.toast-close i {
  font-size: 0.95rem;
}

.toast-success {
  border-color: var(--bioquest-border-strong, rgba(0, 189, 126, 0.32));
  color: var(--bioquest-primary-dark, #1b4332);
  background-color: var(--bioquest-primary-soft, rgba(0, 189, 126, 0.14));
}

.toast-error {
  border-color: rgba(220, 53, 69, 0.3);
  color: #b02a37;
  background-color: #fdecee;
}

.toast-warning {
  border-color: rgba(255, 193, 7, 0.45);
  color: #8a6d00;
  background-color: #fff8db;
}

.toast-info {
  border-color: var(--bioquest-border-strong, rgba(0, 189, 126, 0.32));
  color: var(--bioquest-primary-dark, #1b4332);
  background-color: var(--bioquest-primary-soft, rgba(0, 189, 126, 0.14));
}

:global(html[data-theme='dark']) .app-toast {
  box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.34);
}

:global(html[data-theme='dark']) .toast-close:hover,
:global(html[data-theme='dark']) .toast-close:focus {
  background-color: rgba(255, 255, 255, 0.1);
}

:global(html[data-theme='dark']) .toast-error {
  color: #ffd7dc;
  background-color: rgba(220, 53, 69, 0.16);
  border-color: rgba(220, 53, 69, 0.35);
}

:global(html[data-theme='dark']) .toast-warning {
  color: #ffe9a3;
  background-color: rgba(255, 193, 7, 0.14);
  border-color: rgba(255, 193, 7, 0.36);
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-0.75rem);
}

@media (max-width: 575px) {
  .app-toast {
    top: 4.75rem;
    right: 0.75rem;
    left: 0.75rem;
    width: auto;
  }
}
</style>