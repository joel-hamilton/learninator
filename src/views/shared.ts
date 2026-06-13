/** Shared HTML snippets for all pages. */

export const HTMX_HEAD = `<script src="https://unpkg.com/htmx.org@2.0.4"></script>
<style>
  /* htmx loading indicator */
  .htmx-indicator {
    opacity: 0;
    transition: opacity 200ms ease-in;
  }
  .htmx-request .htmx-indicator,
  .htmx-request.htmx-indicator {
    opacity: 1;
  }

  /* Global loading bar at top of page during requests */
  #htmx-loading-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: #2d2d2d;
    z-index: 9999;
    opacity: 0;
    transition: opacity 150ms;
    width: 0;
  }
  .htmx-request#htmx-loading-bar {
    opacity: 1;
    animation: htmx-load 2s ease-out;
  }
  @keyframes htmx-load {
    0% { width: 0; }
    10% { width: 30%; }
    50% { width: 60%; }
    80% { width: 85%; }
    100% { width: 95%; }
  }

  /* Inline spinner for buttons */
  .btn-loading {
    position: relative;
    pointer-events: none;
  }
  .btn-loading::after {
    content: "";
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.5s linear infinite;
    margin-left: 0.5rem;
    vertical-align: middle;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
<div id="htmx-loading-bar" class="htmx-indicator"></div>`;
