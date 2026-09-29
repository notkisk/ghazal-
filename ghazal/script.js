const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const books = [
  { id: 'stranger', title: 'الغريب', author: 'ألبير كامو', publisher: 'منشورات الجمل', category: 'literature', genre: 'رواية مترجمة', price: 1900, image: 'stranger.jpg', note: 'رواية قصيرة ومكثّفة عن الغربة والعبث والإنسان في مواجهة العالم.' },
  { id: 'world-yesterday', title: 'عالم الأمس', author: 'شتيفان تسفايغ', publisher: 'دار المدى', category: 'history', genre: 'سيرة · تاريخ', price: 2600, image: 'world-yesterday.jpg', note: 'شهادة أدبية حميمة على أوروبا التي غيّرتها الحرب إلى الأبد.' },
  { id: 'meaning', title: 'الإنسان يبحث عن معنى', author: 'فيكتور فرانكل', publisher: 'آكيول', category: 'thought', genre: 'فكر · علم نفس', price: 2200, image: 'meaning.jpg', note: 'تأمل مؤثر في قدرة الإنسان على العثور على معنى وسط أقسى الظروف.' },
  { id: 'orientalism', title: 'الاستشراق', author: 'إدوارد سعيد', publisher: 'دار الآداب', category: 'history', genre: 'فكر · نقد ثقافي', price: 3900, image: 'orientalism.jpg', note: 'كتاب غيّر طريقة قراءة العلاقة بين المعرفة والسلطة وصورة الشرق.' },
  { id: 'meditations', title: 'التأملات', author: 'ماركوس أوريليوس', publisher: 'طبعة عربية', category: 'thought', genre: 'فلسفة · كلاسيكيات', price: 2100, image: 'meditations.jpg', note: 'ملاحظات شخصية عن الاتزان والفضيلة ومواجهة تقلّبات الحياة.' },
  { id: 'solitude', title: 'مئة عام من العزلة', author: 'غابرييل غارسيا ماركيز', publisher: 'دار التنوير', category: 'literature', genre: 'رواية مترجمة', price: 3200, image: 'solitude.jpg', note: 'ملحمة ماكوندو الساحرة، حيث تختلط الذاكرة بالأسطورة والحياة.' },
  { id: 'letters', title: 'رسائل إلى شاعر شاب', author: 'راينر ماريا ريلكه', publisher: 'دار الكرمة', category: 'literature', genre: 'أدب · رسائل', price: 1500, image: 'letters.jpg', note: 'رسائل صادقة عن الكتابة والوحدة والشجاعة على أن يعيش المرء حياته.' },
  { id: 'sophies-world', title: 'عالم صوفي', author: 'جوستاين غاردر', publisher: 'دار المنى', category: 'thought', genre: 'رواية · فلسفة', price: 3600, image: 'sophies-world.jpg', note: 'رحلة روائية تقود أسئلة الفلسفة الكبرى إلى باب فتاة فضولية.' },
  { id: 'plague', title: 'الطاعون', author: 'ألبير كامو', publisher: 'دار التنوير', category: 'literature', genre: 'رواية مترجمة', price: 2400, image: 'plague.jpg', note: 'حكاية مدينة محاصرة، واختبار إنساني للتضامن والاختيار.' },
  { id: 'name-of-rose', title: 'اسم الوردة', author: 'أمبرتو إيكو', publisher: 'دار الكتاب الجديد', category: 'literature', genre: 'رواية · تاريخ', price: 3200, image: 'name-of-rose.jpg', note: 'لغز في دير من العصور الوسطى يفتح أبواب الكتب والمعرفة والسلطة.' },
  { id: 'art-of-loving', title: 'فن الحب', author: 'إريك فروم', publisher: 'طبعة عربية', category: 'thought', genre: 'فكر · إنسانيات', price: 1800, image: 'art-of-loving.jpg', note: 'قراءة في الحب بوصفه فنًا يحتاج إلى معرفة وممارسة وعناية.' },
  { id: 'brief-time', title: 'تاريخ موجز للزمان', author: 'ستيفن هوكينغ', publisher: 'دار التنوير', category: 'history', genre: 'علم · إنسانيات', price: 2900, image: 'brief-time.jpg', note: 'أسئلة الكون والزمن والثقوب السوداء في كتاب علمي صار من كلاسيكيات العصر.' },
];
const byId = Object.fromEntries(books.map(book => [book.id, book]));
const coverUrl = book => `assets/covers/${book.image}`;
const money = value => `${new Intl.NumberFormat('ar-DZ').format(value)} د.ج`;
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional in the demo. */ } }

let cart = readStorage('ghazal.cart.v2', []).filter(item => byId[item.id] && Number.isInteger(item.qty) && item.qty > 0);
let favorites = readStorage('ghazal.favorites.v2', []).filter(id => byId[id]);
let activeFilter = 'all';
let showAllBooks = false;
let checkoutStep = 1;
let checkoutData = null;
let revealObserver;

// Replace the concept covers in the editorial compositions with published editions.
const editionMap = { 'cover-stranger': 'stranger', 'cover-world': 'world-yesterday', 'cover-solitude': 'solitude', 'cover-meaning': 'meaning', 'cover-letters': 'letters', 'cover-orientalism': 'orientalism', 'cover-meditations': 'meditations' };
$$('.cover').forEach(placeholder => {
  const coverClass = Object.keys(editionMap).find(name => placeholder.classList.contains(name));
  if (!coverClass || placeholder.closest('#book-grid')) return;
  const book = byId[editionMap[coverClass]];
  const image = document.createElement('img');
  image.src = coverUrl(book);
  image.alt = `غلاف الطبعة العربية من كتاب ${book.title}`;
  image.className = `${placeholder.className} edition-image`;
  image.loading = placeholder.closest('.hero-art') ? 'eager' : 'lazy';
  image.decoding = 'async';
  placeholder.replaceWith(image);
});
$$('[data-add]').forEach(button => {
  const book = books.find(item => item.title === button.dataset.add || (button.dataset.add === 'تأملات' && item.id === 'meditations'));
  if (book) button.dataset.add = book.id;
});
$$('.feature-description h3,.selection-info h3,.selection-info p,.most-read strong').forEach(element => {
  if (element.textContent.trim() === 'تأملات') element.textContent = 'التأملات';
});

function cardTemplate(book, index) {
  const saved = favorites.includes(book.id);
  return `<article class="book-card" data-id="${book.id}" data-category="${book.category}" style="--stagger:${(index % 4) * 65}ms">
    <button class="book-card-art" data-view="${book.id}" aria-label="اعرض تفاصيل ${book.title}"><img class="edition-image catalog-cover" src="${coverUrl(book)}" alt="غلاف ${book.title}" loading="lazy" decoding="async" /><span class="quick-view">نظرة أقرب <span aria-hidden="true">↖</span></span></button>
    <div class="book-meta"><span>${book.genre}</span><button class="favorite" data-favorite="${book.id}" aria-label="${saved ? 'أزل من المحفوظات' : 'احفظ'} ${book.title}" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button></div>
    <h3><button data-view="${book.id}">${book.title}</button></h3><p>${book.author}</p><div class="card-bottom"><span class="price">${money(book.price)}</span><button class="card-add" data-add="${book.id}" aria-label="أضف ${book.title} إلى السلة">أضف إلى السلة <span aria-hidden="true">↖</span></button></div>
  </article>`;
}
$('#book-grid').insertAdjacentHTML('afterend', '<button id="load-more" class="load-more">اعرض بقية الرفوف <span aria-hidden="true">↖</span></button>');
function renderBooks() {
  const filtered = activeFilter === 'all' ? books : books.filter(book => book.category === activeFilter);
  const visible = showAllBooks || activeFilter !== 'all' ? filtered : filtered.slice(0, 8);
  $('#book-grid').innerHTML = visible.map(cardTemplate).join('');
  $('#load-more').hidden = activeFilter !== 'all' || showAllBooks;
  observeReveals();
}
function applyFilter(filter) {
  activeFilter = filter;
  showAllBooks = false;
  $$('.filter').forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
  renderBooks();
}
$$('.filter').forEach(button => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
$$('[data-select]').forEach(link => link.addEventListener('click', () => applyFilter(link.dataset.select)));
$('#load-more').addEventListener('click', () => { showAllBooks = true; renderBooks(); });
renderBooks();

function showOverlay(id) {
  const overlay = document.getElementById(id);
  overlay.hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => (id === 'search-overlay' ? $('#search-input') : overlay.querySelector('input:not([type="hidden"]),button'))?.focus(), 40);
}
function hideOverlay(id) {
  document.getElementById(id).hidden = true;
  if (!$$('.overlay:not([hidden])').length) document.body.classList.remove('modal-open');
}
function switchOverlay(from, to) { hideOverlay(from); showOverlay(to); }
$('#search-open').addEventListener('click', () => showOverlay('search-overlay'));
$('#cart-open').addEventListener('click', () => showOverlay('cart-overlay'));
$$('[data-close]').forEach(button => button.addEventListener('click', () => hideOverlay(button.dataset.close)));
$$('.overlay').forEach(overlay => overlay.addEventListener('click', event => { if (event.target === overlay) hideOverlay(overlay.id); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') $$('.overlay:not([hidden])').forEach(overlay => hideOverlay(overlay.id)); });

document.body.insertAdjacentHTML('beforeend', '<div id="site-toast" class="site-toast" role="status" aria-live="polite"></div>');
function toast(message) {
  const element = $('#site-toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('visible'), 2800);
}
const cartCount = () => cart.reduce((sum, item) => sum + item.qty, 0);
const subtotal = () => cart.reduce((sum, item) => sum + byId[item.id].price * item.qty, 0);
function syncCart() { saveStorage('ghazal.cart.v2', cart); renderCart(); }
function changeQuantity(id, delta) {
  const item = cart.find(entry => entry.id === id);
  if (!item && delta > 0) cart.push({ id, qty: 1 });
  else if (item) { item.qty += delta; if (item.qty <= 0) cart = cart.filter(entry => entry.id !== id); }
  syncCart();
}
$('.cart-footer').innerHTML = `<div class="cart-totals"><span>المجموع الفرعي</span><strong id="cart-subtotal">٠ د.ج</strong></div><p>تُحسب رسوم التوصيل في الخطوة التالية. الدفع نقدًا عند الاستلام.</p><button id="cart-order" class="button button-dark" type="button">متابعة إلى إتمام الطلب <span aria-hidden="true">↖</span></button>`;
function renderCart() {
  const count = cartCount();
  $('#cart-count').textContent = count;
  $('#cart-open').setAttribute('aria-label', `سلة الكتب، ${count} كتاب`);
  $('#cart-items').innerHTML = count ? cart.map(({ id, qty }) => {
    const book = byId[id];
    return `<div class="cart-item"><img src="${coverUrl(book)}" alt="" /><div class="cart-item-copy"><strong>${book.title}</strong><small>${book.author}</small><span>${money(book.price)}</span><div class="quantity-control"><button data-qty="-1" data-id="${id}" aria-label="أنقص ${book.title}">−</button><output>${qty}</output><button data-qty="1" data-id="${id}" aria-label="زد ${book.title}">+</button></div></div><button class="remove-item" data-remove="${id}" aria-label="احذف ${book.title}">×</button></div>`;
  }).join('') : '<div class="empty-cart"><span>✳</span><p>سلتك تنتظر كتابًا جيدًا.</p><a href="#new" data-close="cart-overlay">تصفّح الكتب <span>↖</span></a></div>';
  $('#cart-subtotal').textContent = money(subtotal());
  $('#cart-order').disabled = count === 0;
  $$('[data-close]', $('#cart-items')).forEach(link => link.addEventListener('click', () => hideOverlay('cart-overlay')));
}
renderCart();
$('#cart-items').addEventListener('click', event => {
  const quantity = event.target.closest('[data-qty]');
  const remove = event.target.closest('[data-remove]');
  if (quantity) changeQuantity(quantity.dataset.id, Number(quantity.dataset.qty));
  if (remove) { cart = cart.filter(entry => entry.id !== remove.dataset.remove); syncCart(); }
});

document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="product-overlay" hidden><div class="product-panel" role="dialog" aria-modal="true" aria-label="تفاصيل الكتاب"><button class="close-button" data-close="product-overlay" aria-label="إغلاق">×</button><div id="product-detail"></div></div></div>
  <div class="overlay checkout-overlay" id="checkout-overlay" hidden><div class="checkout-panel" role="dialog" aria-modal="true" aria-label="إتمام طلب الكتب">
    <button class="close-button" data-close="checkout-overlay" aria-label="إغلاق">×</button>
    <p class="eyebrow">الغزال للكتب / إتمام الطلب</p><h2>من رفوفنا <em>إلى بابك.</em></h2>
    <div class="demo-notice"><span>✳</span> معاينة تجريبية: تُحفظ الطلبات على هذا الجهاز فقط، ولا تُرسل إلى متجر.</div>
    <div class="checkout-steps"><span data-step-label="1">١ · بيانات التوصيل</span><span data-step-label="2">٢ · مراجعة الطلب</span><span data-step-label="3">٣ · التأكيد</span></div>
    <div class="checkout-body">
      <section class="checkout-step" data-step="1"><form id="checkout-form"><div class="field-pair"><label>الاسم الكامل <input name="customer" autocomplete="name" required minlength="3" placeholder="الاسم كما يظهر على الطرد" /></label><label>رقم الهاتف <input name="phone" type="tel" autocomplete="tel" required minlength="9" placeholder="05 / 06 / 07..." /></label></div><div class="field-pair"><label>الولاية <input name="wilaya" required placeholder="مثال: الجزائر" /></label><label>البلدية / المدينة <input name="city" required placeholder="اسم المدينة أو البلدية" /></label></div><label>عنوان التوصيل <textarea name="address" required minlength="8" rows="2" placeholder="الحي، الشارع، رقم المنزل وأقرب معلم"></textarea></label><label>ملاحظات للمُوصّل <textarea name="notes" rows="2" placeholder="اختياري"></textarea></label><fieldset class="delivery-field"><legend>منطقة التوصيل</legend><label><input type="radio" name="delivery" value="capital" checked /><span><strong>الجزائر العاصمة</strong><small>رسوم تجريبية: ٤٠٠ د.ج</small></span></label><label><input type="radio" name="delivery" value="other" /><span><strong>باقي الولايات</strong><small>رسوم تجريبية: ٦٥٠ د.ج</small></span></label></fieldset><div class="payment-note"><span>◉</span><div><strong>الدفع نقدًا عند الاستلام</strong><small>ادفع ثمن الكتب والتوصيل عندما يصلك الطلب.</small></div></div><button class="button button-dark checkout-primary" type="submit">مراجعة الطلب <span>↖</span></button></form></section>
      <section class="checkout-step" data-step="2" hidden><div id="checkout-review"></div><div class="checkout-actions"><button id="checkout-back" class="button button-outline" type="button">تعديل البيانات <span>→</span></button><button id="checkout-confirm" class="button button-dark" type="button">تأكيد الطلب التجريبي <span>↖</span></button></div></section>
      <section class="checkout-step" data-step="3" hidden><div class="confirmation"><span class="confirmation-star">✳</span><h3>وصل طلبك إلى دفتر هذه المعاينة.</h3><p>هذا طلب تجريبي محفوظ في متصفحك. لا يُرسل تلقائيًا إلى متجر.</p><div id="order-receipt"></div><button id="checkout-done" class="button button-dark" type="button">العودة إلى الكتب <span>↖</span></button></div></section>
    </div>
  </div></div>`);
$$('#checkout-form input[name="delivery"]').forEach(input => { input.checked = false; input.required = true; });
['product-overlay', 'checkout-overlay'].forEach(id => {
  const overlay = document.getElementById(id);
  overlay.addEventListener('click', event => { if (event.target === overlay) hideOverlay(id); });
  $('[data-close]', overlay).addEventListener('click', () => hideOverlay(id));
});

function openProduct(id) {
  const book = byId[id];
  $('#product-detail').innerHTML = `<div class="product-image"><img src="${coverUrl(book)}" alt="غلاف ${book.title}" /></div><div class="product-copy"><p class="eyebrow">${book.genre}</p><h2>${book.title}</h2><p class="product-author">${book.author} <span>·</span> ${book.publisher}</p><p class="product-note">${book.note}</p><div class="product-price"><strong>${money(book.price)}</strong><small>سعر تجريبي</small></div><button class="button button-dark" data-add="${book.id}" type="button">أضف إلى السلة <span>↖</span></button><p class="product-shipping">الدفع نقدًا عند الاستلام · تُحسب رسوم التوصيل عند إتمام الطلب</p></div>`;
  showOverlay('product-overlay');
}
document.addEventListener('click', event => {
  const view = event.target.closest('[data-view]');
  const add = event.target.closest('[data-add]');
  const favorite = event.target.closest('[data-favorite]');
  if (view) openProduct(view.dataset.view);
  if (add) {
    const id = add.dataset.add;
    if (!byId[id]) return;
    changeQuantity(id, 1);
    if (!$('#product-overlay').hidden) hideOverlay('product-overlay');
    toast(`أضفنا «${byId[id].title}» إلى سلتك`);
    $('#cart-open').classList.remove('cart-bump');
    void $('#cart-open').offsetWidth;
    $('#cart-open').classList.add('cart-bump');
  }
  if (favorite) {
    const id = favorite.dataset.favorite;
    favorites = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id];
    saveStorage('ghazal.favorites.v2', favorites);
    favorite.setAttribute('aria-pressed', String(favorites.includes(id)));
    favorite.textContent = favorites.includes(id) ? '♥' : '♡';
    toast(favorites.includes(id) ? 'أُضيف إلى محفوظاتك' : 'أُزيل من محفوظاتك');
  }
});

$('#cart-order').addEventListener('click', () => {
  if (!cart.length) return;
  checkoutStep = 1;
  renderCheckoutStep();
  switchOverlay('cart-overlay', 'checkout-overlay');
});
const deliveryCost = zone => zone === 'capital' ? 400 : 650;
function renderCheckoutStep() {
  $$('[data-step]', $('#checkout-overlay')).forEach(section => { section.hidden = Number(section.dataset.step) !== checkoutStep; });
  $$('[data-step-label]', $('#checkout-overlay')).forEach(label => label.classList.toggle('current', Number(label.dataset.stepLabel) === checkoutStep));
}
$('#checkout-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  if (!/^[+\d\s()\-]{9,18}$/.test(data.phone.trim())) { form.elements.phone.setCustomValidity('أدخل رقم هاتف صحيحًا.'); form.elements.phone.reportValidity(); return; }
  form.elements.phone.setCustomValidity('');
  checkoutData = data;
  const lines = cart.map(({ id, qty }) => `<div class="review-line"><span>${byId[id].title} <small>× ${qty}</small></span><strong>${money(byId[id].price * qty)}</strong></div>`).join('');
  $('#checkout-review').innerHTML = `<div class="review-block"><h3>كتبك المختارة</h3>${lines}<div class="review-line"><span>رسوم التوصيل</span><strong>${money(deliveryCost(data.delivery))}</strong></div><div class="review-line review-total"><span>الإجمالي عند الاستلام</span><strong>${money(subtotal() + deliveryCost(data.delivery))}</strong></div></div><div class="review-block"><h3>التوصيل والدفع</h3><p id="review-address"></p><p>الدفع نقدًا عند الاستلام</p></div>`;
  $('#review-address').textContent = `${data.customer} · ${data.phone} · ${data.address}، ${data.city}، ${data.wilaya}`;
  checkoutStep = 2;
  renderCheckoutStep();
  $('.checkout-panel').scrollTo({ top: 0, behavior: 'smooth' });
});
$('#checkout-form [name="phone"]').addEventListener('input', event => event.target.setCustomValidity(''));
$('#checkout-back').addEventListener('click', () => { checkoutStep = 1; renderCheckoutStep(); });
$('#checkout-confirm').addEventListener('click', () => {
  if (!checkoutData || !cart.length) return;
  const order = {
    reference: `GZ-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    placedAt: new Date().toISOString(),
    customer: checkoutData,
    items: cart.map(item => ({ ...item })),
    subtotal: subtotal(), delivery: deliveryCost(checkoutData.delivery),
    total: subtotal() + deliveryCost(checkoutData.delivery),
    payment: 'cash_on_delivery', demo: true
  };
  saveStorage('ghazal.demoOrders.v1', [order, ...readStorage('ghazal.demoOrders.v1', [])].slice(0, 20));
  cart = [];
  syncCart();
  $('#order-receipt').innerHTML = `<span>رقم الطلب التجريبي</span><strong dir="ltr">${order.reference}</strong><span>الإجمالي نقدًا عند الاستلام</span><strong>${money(order.total)}</strong>`;
  checkoutStep = 3;
  renderCheckoutStep();
  $('.checkout-panel').scrollTo({ top: 0, behavior: 'smooth' });
});
$('#checkout-done').addEventListener('click', () => { hideOverlay('checkout-overlay'); document.getElementById('new').scrollIntoView({ behavior: 'smooth' }); });

$('#search-input').addEventListener('input', event => {
  const query = event.target.value.trim().toLocaleLowerCase('ar');
  const results = books.filter(book => `${book.title} ${book.author} ${book.publisher}`.toLocaleLowerCase('ar').includes(query));
  $('#search-results').innerHTML = query ? (results.length ? results.map(book => `<button class="search-result" data-search-id="${book.id}"><img src="${coverUrl(book)}" alt="" /><span><strong>${book.title}</strong><small>${book.author} · ${money(book.price)}</small></span><span>↖</span></button>`).join('') : '<p class="search-empty">لم نجد هذا العنوان. جرّب كلمة أخرى.</p>') : '<p class="search-empty">جرّب البحث عن كتاب أو اسم مؤلف.</p>';
});
$('#search-results').addEventListener('click', event => {
  const result = event.target.closest('[data-search-id]');
  if (result) { hideOverlay('search-overlay'); openProduct(result.dataset.searchId); }
});
$('#menu-toggle').addEventListener('click', () => {
  const open = $('.main-nav').classList.toggle('open');
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
});
$$('.main-nav a').forEach(link => link.addEventListener('click', () => {
  $('.main-nav').classList.remove('open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
}));
$('#newsletter-form').addEventListener('submit', event => {
  event.preventDefault();
  saveStorage('ghazal.demoNewsletter', $('#email').value.trim());
  $('#newsletter-message').textContent = 'حُفظ بريدك في هذه المعاينة فقط. لم يُرسل الاشتراك.';
  $('#email').value = '';
});

function observeReveals() {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!revealObserver) revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  }), { threshold: .09, rootMargin: '0px 0px -24px 0px' });
  $$('.section-heading,.feature-story,.selection-item,.book-card,.most-read-copy,.most-read-stage,.department-intro,.department-links a,.publisher,.journal-copy,.newsletter').forEach(element => {
    if (!element.classList.contains('reveal')) { element.classList.add('reveal'); revealObserver.observe(element); }
  });
}
observeReveals();
if (window.matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)').matches) {
  $('.hero-art').addEventListener('pointermove', event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    $$('.hero-book').forEach((element, index) => { element.style.translate = `${x * (index + 1) * 5}px ${y * (index + 1) * 5}px`; });
  });
  $('.hero-art').addEventListener('pointerleave', () => $$('.hero-book').forEach(element => { element.style.translate = '0 0'; }));
}
