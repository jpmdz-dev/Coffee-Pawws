/* =========================================================
   The Coffee Paws – cart.js
   Add-to-cart buttons, slide-out cart, and checkout.

   Needs on the page:
     • <button class="add-to-cart" data-name="..." data-price="150">
     • <button class="cart-toggle"> in the header
   The cart panel itself is built by this script.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Settings ---------- */
  // Orders are sent to this address (the customer's email app opens
  // with the order filled in). Replace with your shop's email.
  var ORDER_EMAIL = 'orders@yourshop.com';
  var STORAGE_KEY = 'coffeepaws-cart';
  var PESO = '\u20B1';

  /* ---------- State ---------- */
  var cart = load();
  var step = 'cart'; // 'cart' | 'form' | 'done'
  var lastFocus = null;

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(data)) {
        return data.filter(function (i) {
          return i && i.id && i.name && i.price >= 0 && i.qty > 0;
        });
      }
    } catch (e) { /* storage unavailable: start with an empty cart */ }
    return [];
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) { /* ignore */ }
  }

  function money(n) { return PESO + n.toLocaleString('en-PH'); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function totals() {
    return cart.reduce(function (t, i) {
      t.count += i.qty;
      t.sum += i.qty * i.price;
      return t;
    }, { count: 0, sum: 0 });
  }

  /* ---------- Build the cart panel ---------- */
  document.body.insertAdjacentHTML('beforeend',
    '<div class="cart-overlay" data-cart-close></div>' +
    '<aside class="cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true">' +
      '<div class="cart-head">' +
        '<h2 id="cart-title">Your order</h2>' +
        '<button type="button" class="cart-close" data-cart-close aria-label="Close cart">&times;</button>' +
      '</div>' +
      '<div class="cart-body">' +
        '<p class="cart-empty">Your cart is empty. Add a drink or pastry to get started.</p>' +
        '<ul class="cart-items"></ul>' +
        '<form class="cart-form" hidden>' +
          '<h3>Pickup details</h3>' +
          '<label>Name<input type="text" name="name" autocomplete="name" required></label>' +
          '<label>Phone number<input type="tel" name="phone" autocomplete="tel" required></label>' +
          '<label>Pickup time (optional)<input type="time" name="time" min="08:00" max="22:00"></label>' +
          '<p class="cart-hint">We are open 8:00 AM to 10:00 PM, Monday to Friday. Pay at the counter when you pick up.</p>' +
          '<label>Notes (optional)<textarea name="notes" rows="2"></textarea></label>' +
          '<button type="button" class="cart-back">Back to cart</button>' +
        '</form>' +
        '<div class="cart-done" hidden></div>' +
      '</div>' +
      '<div class="cart-foot">' +
        '<div class="cart-total"><span>Total</span><strong>' + money(0) + '</strong></div>' +
        '<button type="button" class="cart-checkout">Checkout</button>' +
      '</div>' +
    '</aside>' +
    '<div class="sr-only" id="cart-status" aria-live="polite"></div>'
  );

  var drawer = document.getElementById('cart-drawer');
  var status = document.getElementById('cart-status');
  var itemsEl = drawer.querySelector('.cart-items');
  var emptyEl = drawer.querySelector('.cart-empty');
  var formEl = drawer.querySelector('.cart-form');
  var doneEl = drawer.querySelector('.cart-done');
  var footEl = drawer.querySelector('.cart-foot');
  var totalEl = drawer.querySelector('.cart-total strong');
  var checkoutBtn = drawer.querySelector('.cart-checkout');
  var closeBtn = drawer.querySelector('.cart-close');
  var titleEl = drawer.querySelector('#cart-title');

  /* ---------- Render ---------- */
  function render() {
    var t = totals();

    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = t.count;
      el.hidden = t.count === 0;
    });
    document.querySelectorAll('.cart-toggle').forEach(function (btn) {
      btn.setAttribute('aria-label',
        t.count ? 'Open cart, ' + t.count + (t.count === 1 ? ' item' : ' items') : 'Open cart');
    });

    if (!cart.length && step === 'form') step = 'cart';

    itemsEl.innerHTML = cart.map(function (i) {
      return '<li data-id="' + esc(i.id) + '">' +
        '<span class="cart-item-name">' + esc(i.name) + '</span>' +
        '<span class="cart-item-total">' + money(i.qty * i.price) + '</span>' +
        '<span class="cart-qty">' +
          '<button type="button" data-act="dec" aria-label="Remove one ' + esc(i.name) + '">&minus;</button>' +
          '<span aria-label="Quantity">' + i.qty + '</span>' +
          '<button type="button" data-act="inc" aria-label="Add one more ' + esc(i.name) + '">+</button>' +
        '</span>' +
        '<button type="button" class="cart-remove" data-act="remove" aria-label="Remove ' + esc(i.name) + ' from cart">Remove</button>' +
      '</li>';
    }).join('');

    var done = step === 'done';
    itemsEl.hidden = done;
    emptyEl.hidden = done || cart.length > 0;
    formEl.hidden = step !== 'form';
    doneEl.hidden = !done;
    footEl.hidden = done;
    titleEl.textContent = done ? 'Almost done' : 'Your order';

    totalEl.textContent = money(t.sum);
    checkoutBtn.disabled = cart.length === 0;
    checkoutBtn.textContent = step === 'form' ? 'Place order' : 'Checkout';
  }

  /* ---------- Cart actions ---------- */
  function addItem(name, price) {
    var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var found = cart.find(function (i) { return i.id === id; });
    if (found) found.qty += 1;
    else cart.push({ id: id, name: name, price: price, qty: 1 });
    save();
    render();
    status.textContent = name + ' added to cart. ' + totals().count + ' items in cart.';
  }

  function changeQty(id, delta) {
    var item = cart.find(function (i) { return i.id === id; });
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(function (i) { return i.id !== id; });
    save();
    render();
  }

  function removeItem(id) {
    cart = cart.filter(function (i) { return i.id !== id; });
    save();
    render();
  }

  /* ---------- Open / close ---------- */
  function openCart() {
    lastFocus = document.activeElement;
    document.body.classList.add('cart-open');
    drawer.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function closeCart() {
    document.body.classList.remove('cart-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (step === 'done') { step = 'cart'; render(); }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- Checkout ---------- */
  function placeOrder() {
    var data = new FormData(formEl);
    var t = totals();
    var orderNo = 'CP-' + Date.now().toString(36).toUpperCase().slice(-5);

    var lines = cart.map(function (i) {
      return i.qty + ' x ' + i.name + ' - ' + money(i.qty * i.price);
    });

    var body = [
      'Order ' + orderNo,
      '',
      'Name: ' + data.get('name'),
      'Phone: ' + data.get('phone'),
      'Pickup time: ' + (data.get('time') || 'As soon as possible'),
      'Notes: ' + (data.get('notes') || '-'),
      '',
      'Items:'
    ].concat(lines, ['', 'Total: ' + money(t.sum), 'Payment: at the counter on pickup']).join('\n');

    var mailto = 'mailto:' + ORDER_EMAIL +
      '?subject=' + encodeURIComponent('Online order ' + orderNo) +
      '&body=' + encodeURIComponent(body);

    /* To send orders to your own server instead, replace the mailto
       below with a fetch('/your-endpoint', { method: 'POST', ... }) call
       and show the confirmation only after it succeeds. */

    doneEl.innerHTML =
      '<h3>Send your order to finish</h3>' +
      '<p>Your email app should open with order <strong>' + orderNo + '</strong> filled in. ' +
      'Press Send to place it. If nothing opened, use the button below.</p>' +
      '<ul class="cart-summary">' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      '<p class="cart-summary-total">Total: ' + money(t.sum) + '</p>' +
      '<a class="cart-send" href="' + esc(mailto) + '">Open email app</a>' +
      '<button type="button" class="cart-back" data-cart-close>Back to menu</button>';

    cart = [];
    save();
    step = 'done';
    formEl.reset();
    render();
    window.location.href = mailto;
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (e) {
    var add = e.target.closest('.add-to-cart');
    if (add) {
      var price = parseFloat(add.dataset.price);
      if (!add.dataset.name || isNaN(price)) return;
      addItem(add.dataset.name, price);

      if (!add.dataset.label) add.dataset.label = add.textContent;
      clearTimeout(add._timer);
      add.classList.add('added');
      add.textContent = 'Added';
      add._timer = setTimeout(function () {
        add.classList.remove('added');
        add.textContent = add.dataset.label;
      }, 1200);
      return;
    }

    if (e.target.closest('.cart-toggle')) { openCart(); return; }
    if (e.target.closest('[data-cart-close]')) { closeCart(); return; }

    var act = e.target.closest('[data-act]');
    if (act && drawer.contains(act)) {
      var id = act.closest('li').dataset.id;
      if (act.dataset.act === 'inc') changeQty(id, 1);
      else if (act.dataset.act === 'dec') changeQty(id, -1);
      else removeItem(id);
      return;
    }

    if (e.target.closest('.cart-back') && !e.target.closest('[data-cart-close]')) {
      step = 'cart';
      render();
    }
  });

  checkoutBtn.addEventListener('click', function () {
    if (!cart.length) return;
    if (step === 'cart') {
      step = 'form';
      render();
      var first = formEl.querySelector('input');
      if (first) first.focus();
    } else if (step === 'form') {
      if (formEl.reportValidity()) placeOrder();
    }
  });

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    if (cart.length) placeOrder();
  });

  document.addEventListener('keydown', function (e) {
    if (!document.body.classList.contains('cart-open')) return;

    if (e.key === 'Escape') { closeCart(); return; }

    // Keep Tab inside the open cart
    if (e.key === 'Tab') {
      var focusable = Array.prototype.filter.call(
        drawer.querySelectorAll('button, a[href], input, textarea'),
        function (el) { return !el.disabled && el.offsetParent !== null; }
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  render();
})();