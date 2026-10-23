// Keep submission data in the form only; never log or persist it.
const form = document.querySelector('#contact-form');
const response = document.querySelector('#contact-form-response');
const panel = document.querySelector('#form-response-panel');
const status = document.querySelector('#form-status');
const button = form?.querySelector('.form-submit');
const trap = document.querySelector('#contact-website');
let pending = false;
let lastSubmitted = -Infinity;
let timer;

if (form && response && panel && status && button && trap) {
  panel.hidden = true;
  form.addEventListener('submit', event => {
    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
      return;
    }
    if (trap.value.trim()) {
      event.preventDefault();
      status.textContent = 'Submission blocked. Please use the Google Form link if you need help.';
      return;
    }
    if (!navigator.onLine) {
      event.preventDefault();
      status.textContent = 'You appear to be offline. Reconnect, then try again.';
      return;
    }
    if (pending || Date.now() - lastSubmitted < 30000) {
      event.preventDefault();
      status.textContent = 'Please wait 30 seconds between submission attempts.';
      return;
    }
    pending = true;
    lastSubmitted = Date.now();
    button.disabled = true;
    panel.hidden = false;
    status.textContent = 'Sending to Google Forms. Check the response below for confirmation or errors.';
    timer = setTimeout(() => {
      pending = false;
      button.disabled = false;
      status.textContent = 'Delivery could not be confirmed. Check the response below or use the Google Form link. Your message is still in the form.';
    }, 30000);
  });
  response.addEventListener('load', () => {
    if (!pending) return;
    clearTimeout(timer);
    pending = false;
    button.disabled = false;
    // Cross-origin frame content cannot be checked. Never infer success or erase input.
    status.textContent = 'Google Forms responded. Check below for confirmation or validation errors. Your message is still in the form.';
  });
  response.addEventListener('error', () => {
    if (!pending) return;
    clearTimeout(timer);
    pending = false;
    button.disabled = false;
    status.textContent = 'The response could not be loaded. Use the Google Form link to check or retry. Your message is still in the form.';
  });
}
