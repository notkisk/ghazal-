const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function enhanceOwnerSelect(select) {
  if (!select || select.dataset.customized) return;
  select.dataset.customized = 'true';
  const wrapper = document.createElement('div'); wrapper.className = 'custom-select'; select.parentNode.insertBefore(wrapper, select); wrapper.appendChild(select); select.classList.add('custom-select-native');
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'custom-select-trigger'; trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div'); menu.className = 'custom-select-menu'; menu.setAttribute('role', 'listbox'); wrapper.append(trigger, menu);
  const sync = () => { const selected = select.options[select.selectedIndex]; trigger.innerHTML = `<span>${selected?.textContent || 'اختر'}</span><i aria-hidden="true">⌄</i>`; menu.innerHTML = [...select.options].map((option, index) => `<button type="button" role="option" data-index="${index}" aria-selected="${option.selected}">${option.textContent}</button>`).join(''); };
  trigger.addEventListener('click', () => wrapper.classList.toggle('open'));
  menu.addEventListener('click', event => { const option = event.target.closest('[data-index]'); if (!option) return; select.selectedIndex = Number(option.dataset.index); select.dispatchEvent(new Event('change', { bubbles: true })); sync(); wrapper.classList.remove('open'); });
  select.addEventListener('change', sync); new MutationObserver(sync).observe(select, { childList: true, attributes: true, subtree: true }); sync();
}
new MutationObserver(() => $$('select').forEach(enhanceOwnerSelect)).observe(document.body, { childList: true, subtree: true });
const OWNER_CODE = 'ghazal-owner-2026';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const money = value => `${new Intl.NumberFormat('ar-DZ').format(value)} د.ج`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const baseBooks = [
  ['stranger','الغريب','ألبير كامو','منشورات الجمل',1900],['world-yesterday','عالم الأمس','شتيفان تسفايغ','دار المدى',2600],['meaning','الإنسان يبحث عن معنى','فيكتور فرانكل','آكيول',2200],['orientalism','الاستشراق','إدوارد سعيد','دار الآداب',3900],['meditations','التأملات','ماركوس أوريليوس','طبعة عربية',2100],['solitude','مئة عام من العزلة','غابرييل غارسيا ماركيز','دار التنوير',3200],['letters','رسائل إلى شاعر شاب','راينر ماريا ريلكه','دار الكرمة',1500],['sophies-world','عالم صوفي','جوستاين غاردر','دار المنى',3600],['plague','الطاعون','ألبير كامو','دار التنوير',2400],['name-of-rose','اسم الوردة','أمبرتو إيكو','دار الكتاب الجديد',3200],['art-of-loving','فن الحب','إريك فروم','طبعة عربية',1800],['brief-time','تاريخ موجز للزمان','ستيفن هوكينغ','دار التنوير',2900]
].map(([id,title,author,publisher,price]) => ({id,title,author,publisher,price}));
const customBooks = read('ghazal.customBooks.v1', []);
const bookOverrides = new Map(customBooks.map(book => [book.id, book]));
const books = baseBooks.map(book => ({ ...book, ...(bookOverrides.get(book.id) || {}) }));
customBooks.filter(book => !books.some(existing => existing.id === book.id)).forEach(book => books.push(book));
const defaultCovers = { stranger:'stranger.jpg', 'world-yesterday':'world-yesterday.jpg', meaning:'meaning.jpg', orientalism:'orientalism.jpg', meditations:'meditations.jpg', solitude:'solitude.jpg', letters:'letters.jpg', 'sophies-world':'sophies-world.jpg', plague:'plague.jpg', 'name-of-rose':'name-of-rose.jpg', 'art-of-loving':'art-of-loving.jpg', 'brief-time':'brief-time.jpg' };
books.forEach(book => { if (!book.image) book.image = defaultCovers[book.id] || 'meaning.jpg'; });
books.forEach(book => { if (!Number.isFinite(Number(book.stock))) book.stock = 10; });
const defaultFeaturedBooks = ['meaning', 'letters', 'orientalism', 'meditations'];
let featuredBookIds = read('ghazal.featuredBooks.v1', defaultFeaturedBooks);
const defaultPublishers = ['دار الآداب','دار التنوير','دار المدى','منشورات الجمل','دار الكرمة'].map((name, index) => ({ id:`default-${index}`, name, city:'الجزائر', logo:name.slice(0,1) }));
const publishers = [...defaultPublishers, ...read('ghazal.customPublishers.v1', [])];
const authorProfiles = read('ghazal.authorProfiles.v1', {});
const genres = { literature:{title:'الأدب العالمي',description:'حكايات تعبر الحدود.'}, thought:{title:'الفكر والفلسفة',description:'أسئلة توسّع الأفق.'}, history:{title:'التاريخ والإنسانيات',description:'لفهم ما كان وما يكون.'}, ...read('ghazal.genres.v1', {}) };
let orders = read('ghazal.demoOrders.v1', []);
let discounts = read('ghazal.discounts.v1', []);
let orderStartDate = '';
let orderEndDate = '';
let selectedOrderRefs = new Set();
let expandedOrderRefs = new Set();
let bookQuery = '';
let bookStockFilter = 'all';
let bookCategoryFilter = 'all';
let bulkBookRows = [];
let bulkBookHeaders = [];
let bulkBookMapping = {};
const ECOTRACK_COLUMNS = ['reference commande','nom et prenom du destinataire*','telephone*','telephone 2','code wilaya*','wilaya de livraison','commune de livraison*','adresse de livraison*','produit*','poids (kg)','montant du colis*','remarque','FRAGILE\n( si oui mettez OUI sinon laissez vide )','ECHANGE\n( si oui mettez OUI sinon laissez vide )','PICK UP\n( si oui mettez OUI sinon laissez vide )','RECOUVREMENT\n( si oui mettez OUI sinon laissez vide )','STOP DESK\n( si oui mettez OUI sinon laissez vide )','Lien map'];
let ownerTab = 'books';

function ensureDashboardPanels() {
  const actions = $('.owner-grid .owner-actions');
  if (actions && !actions.querySelector('[data-owner-form="genre"]')) { const button = document.createElement('button'); button.className = 'button button-outline'; button.type = 'button'; button.dataset.ownerForm = 'genre'; button.textContent = 'إضافة تصنيف'; actions.appendChild(button); button.addEventListener('click', () => openForm('genre')); }
  if (actions && !actions.querySelector('[data-owner-form="discount"]')) { const button = document.createElement('button'); button.className = 'button button-outline'; button.type = 'button'; button.dataset.ownerForm = 'discount'; button.textContent = 'إضافة خصم'; actions.appendChild(button); button.addEventListener('click', () => openForm('discount')); }
  if (actions && !actions.querySelector('[data-owner-form="featured"]')) { const button = document.createElement('button'); button.className = 'button button-outline'; button.type = 'button'; button.dataset.ownerForm = 'featured'; button.textContent = 'تعديل المختارات'; actions.appendChild(button); button.addEventListener('click', () => openForm('featured')); }
  const tabs = $('.admin-tabs');
  if (tabs && !tabs.querySelector('[data-owner-tab="genres"]')) {
    const genreTab = document.createElement('button'); genreTab.type = 'button'; genreTab.dataset.ownerTab = 'genres'; genreTab.textContent = 'التصنيفات'; tabs.insertBefore(genreTab, tabs.querySelector('[data-owner-tab="orders"]'));
    genreTab.addEventListener('click', () => { ownerTab = 'genres'; $$('.admin-tabs button').forEach(item => item.classList.toggle('active', item === genreTab)); renderOwner(); });
  }
  if (tabs && !tabs.querySelector('[data-owner-tab="discounts"]')) { const discountTab = document.createElement('button'); discountTab.type = 'button'; discountTab.dataset.ownerTab = 'discounts'; discountTab.textContent = 'الخصومات'; tabs.insertBefore(discountTab, tabs.querySelector('[data-owner-tab="orders"]')); discountTab.addEventListener('click', () => { ownerTab = 'discounts'; $$('.admin-tabs button').forEach(item => item.classList.toggle('active', item === discountTab)); renderOwner(); }); }
  if (tabs && !tabs.querySelector('[data-owner-tab="featured"]')) { const featuredTab = document.createElement('button'); featuredTab.type = 'button'; featuredTab.dataset.ownerTab = 'featured'; featuredTab.textContent = 'المختارات'; tabs.insertBefore(featuredTab, tabs.querySelector('[data-owner-tab="orders"]')); featuredTab.addEventListener('click', () => { ownerTab = 'featured'; $$('.admin-tabs button').forEach(item => item.classList.toggle('active', item === featuredTab)); renderOwner(); }); }
  if (tabs && !tabs.querySelector('[data-owner-tab="unavailable"]')) { const unavailableTab = document.createElement('button'); unavailableTab.type = 'button'; unavailableTab.dataset.ownerTab = 'unavailable'; unavailableTab.textContent = 'غير متوفرة'; tabs.insertBefore(unavailableTab, tabs.querySelector('[data-owner-tab="orders"]')); unavailableTab.addEventListener('click', () => { ownerTab = 'unavailable'; $$('.admin-tabs button').forEach(item => item.classList.toggle('active', item === unavailableTab)); renderOwner(); }); }
  if (!$('#owner-average-order')) $('.stat-grid').insertAdjacentHTML('beforeend', '<article><span>متوسط الطلب</span><strong id="owner-average-order">٠ د.ج</strong><small>قيمة الطلب الواحد</small></article><article><span>جاهز لـ Ecotrack</span><strong id="owner-ecotrack-count">٠</strong><small>طلبات لها صف شحن</small></article>');
  if (!$('#owner-extra-panels')) {
    $('#owner-app').insertAdjacentHTML('beforeend', `<section class="owner-dashboard-lower" id="owner-extra-panels"><article class="dashboard-card"><div class="card-heading"><div><p class="eyebrow">آخر الحركة</p><h2>أحدث <em>الطلبات</em></h2></div><button class="text-button" id="owner-see-orders" type="button">كل الطلبات ↙</button></div><div id="owner-recent-orders" class="owner-recent-orders"></div></article><article class="dashboard-card owner-guide"><p class="eyebrow">دليل المالك</p><h2>اختبر المتجر <em>بهدوء.</em></h2><p>افتح المتجر في تبويب آخر، أضف كتابًا إلى السلة، أكمل بيانات التوصيل، ثم أكد الطلب. سيظهر هنا تلقائيًا بعد تحديث لوحة المالكين.</p><ol><li>المتجر: <code>index.html</code></li><li>لوحة المالكين: <code>admin.html</code></li><li>رمز المعاينة: <code>ghazal-owner-2026</code></li></ol><small>كل البيانات التجريبية محفوظة في Local Storage على نفس المتصفح.</small></article></section>`);
    $('#owner-see-orders').addEventListener('click', () => { ownerTab = 'orders'; $$('.admin-tabs button').forEach(item => item.classList.toggle('active', item.dataset.ownerTab === 'orders')); renderOwner(); });
  }
}
function renderRecentOrders() {
  const target = $('#owner-recent-orders'); if (!target) return;
  target.innerHTML = orders.length ? orders.slice(0, 5).map(order => `<button class="owner-recent-order" type="button" data-owner-tab="orders"><span class="admin-avatar">↙</span><span><strong>${esc(order.reference)}</strong><small>${esc(order.customer?.customer || '')} · ${esc(order.customer?.wilaya || '')} · ${order.items?.length || 0} عناوين</small></span><b>${money(order.total || 0)}</b></button>`).join('') : '<p class="owner-note">ستظهر الطلبات المؤكدة هنا.</p>';
  $$('#owner-recent-orders [data-owner-tab]').forEach(button => button.addEventListener('click', () => { ownerTab = 'orders'; $$('.admin-tabs button').forEach(item => item.classList.toggle('active', item.dataset.ownerTab === 'orders')); renderOwner(); }));
}

function filteredOrders() {
  return orders.filter(order => {
    const day = String(order.placedAt || '').slice(0, 10);
    return (!orderStartDate || day >= orderStartDate) && (!orderEndDate || day <= orderEndDate);
  });
}
function orderBook(item) { return books.find(book => book.id === item.id) || { title: item.title || 'كتاب غير معروف', author: '', publisher: '', price: item.price || 0, image: 'meaning.jpg' }; }
function orderDetails(order) {
  const customer = order.customer || {};
  const shipment = order.shipping || {};
  const fields = [
    ['الاسم واللقب', customer.customer], ['الهاتف', customer.phone], ['هاتف ثانٍ', customer.phone2 || '—'],
    ['الولاية', `${customer.wilaya || '—'} (${customer.wilayaCode ?? '—'})`], ['الدائرة', customer.daira || '—'], ['البلدية', customer.communeArabic || customer.commune || customer.city || '—'],
    ['العنوان', customer.address], ['نوع الشحن', customer.shipmentType === 'office' ? 'استلام من المكتب' : 'إيصال للمنزل'], ['سعر الشحن', money(shipment.price ?? order.delivery ?? 0)],
    ['تاريخ الطلب', order.placedAt ? new Date(order.placedAt).toLocaleString('ar-DZ') : '—'], ['الخريطة', customer.mapLink ? `<a href="${esc(customer.mapLink)}" target="_blank" rel="noreferrer">فتح الرابط</a>` : '—'], ['ملاحظات', customer.notes || '—']
  ];
  return `<div class="order-details"><div class="order-detail-grid">${fields.map(([label, value]) => `<div><span>${label}</span><strong>${typeof value === 'string' && value.includes('<a ') ? value : esc(value)}</strong></div>`).join('')}</div><div class="order-books"><h4>الكتب المطلوبة</h4>${(order.items || []).map(item => { const book = orderBook(item); return `<div class="order-book-line"><img src="${book.image?.startsWith('data:') ? book.image : `assets/covers/${book.image || 'meaning.jpg'}`}" alt="" /><span><strong>${esc(book.title)}</strong><small>${esc(book.author)} · ${esc(book.publisher)} · ${money(book.price)} × ${Number(item.qty || 1)}</small></span><b>${money(book.price * Number(item.qty || 1))}</b></div>`; }).join('') || '<p class="owner-note">لا توجد كتب مرتبطة بهذا الطلب.</p>'}</div><div class="order-total-lines"><span>المجموع قبل الشحن <b>${money(order.subtotal || 0)}</b></span><span>الإجمالي عند الاستلام <b>${money(order.total || 0)}</b></span></div></div>`;
}
function renderOrderWorkspace() {
  const list = $('#owner-list');
  const visible = filteredOrders();
  selectedOrderRefs = new Set([...selectedOrderRefs].filter(reference => orders.some(order => order.reference === reference)));
  const allVisibleSelected = visible.length > 0 && visible.every(order => selectedOrderRefs.has(order.reference));
  list.innerHTML = `<div class="order-toolbar"><div class="order-date-filters"><label>من <input id="order-start-date" type="date" value="${esc(orderStartDate)}" /></label><label>إلى <input id="order-end-date" type="date" value="${esc(orderEndDate)}" /></label><button class="text-button" type="button" data-order-clear-filter>مسح التاريخ</button></div><div class="order-toolbar-actions"><button class="button button-outline" type="button" data-order-select-visible>${allVisibleSelected ? 'إلغاء تحديد الظاهر' : 'تحديد الظاهر'}</button><button class="button button-dark" type="button" data-order-export>تصدير المحدد</button><button class="text-button" type="button" data-order-clear-selection>إلغاء التحديد</button></div><p class="order-selection-summary">${visible.length} طلب ظاهر · ${selectedOrderRefs.size} محدد<br><small>إن لم تحدد طلبات، سيُصدّر كل ما يطابق التاريخ.</small></p></div><div class="order-list">${visible.length ? visible.map(order => { const open = expandedOrderRefs.has(order.reference); return `<article class="order-card ${open ? 'is-open' : ''}"><div class="order-card-head"><label class="order-check"><input type="checkbox" data-order-select="${esc(order.reference)}" ${selectedOrderRefs.has(order.reference) ? 'checked' : ''} /><span class="sr-only">تحديد ${esc(order.reference)}</span></label><button class="order-main-button" type="button" data-order-toggle="${esc(order.reference)}"><strong>${esc(order.reference)}</strong><small>${esc(order.customer?.customer || '')} · ${esc(order.customer?.wilaya || '')} · ${esc(order.customer?.communeArabic || order.customer?.commune || '')}</small></button><span class="order-card-total">${money(order.total || 0)}</span><button class="order-delete" type="button" data-order-delete="${esc(order.reference)}" aria-label="حذف ${esc(order.reference)}">حذف</button></div>${open ? orderDetails(order) : ''}</article>`; }).join('') : '<p class="owner-note">لا توجد طلبات تطابق هذا النطاق.</p>'}</div>`;
}
function bookMatches(book) {
  const query = bookQuery.trim().toLocaleLowerCase('ar');
  return (!query || `${book.title} ${book.author} ${book.publisher}`.toLocaleLowerCase('ar').includes(query)) && (bookStockFilter === 'all' || (bookStockFilter === 'available' ? Number(book.stock) > 0 : Number(book.stock) <= 0)) && (bookCategoryFilter === 'all' || book.category === bookCategoryFilter);
}
function renderBooksWorkspace() {
  const list = $('#owner-list');
  const filtered = books.filter(bookMatches);
  const unavailable = books.filter(book => Number(book.stock) <= 0);
  const unavailableSection = `<section class="unavailable-books"><div><p class="eyebrow">تحتاج انتباهك</p><h3>كتب <em>غير متوفرة</em></h3><small>${unavailable.length ? 'يمكنك إعادة التخزين من زر التعديل.' : 'ممتاز، كل الكتب متوفرة حاليًا.'}</small></div>${unavailable.length ? `<div class="unavailable-book-chips">${unavailable.map(book => `<button type="button" data-edit-book="${esc(book.id)}"><span>${esc(book.title)}</span><b>إعادة التخزين</b></button>`).join('')}</div>` : ''}</section>`;
  list.innerHTML = `<div class="book-workspace-toolbar"><label class="admin-search"><span>⌕</span><input id="owner-book-search" type="search" value="${esc(bookQuery)}" placeholder="ابحث بالعنوان أو المؤلف أو الناشر" /></label><select id="owner-book-stock"><option value="all" ${bookStockFilter === 'all' ? 'selected' : ''}>كل حالات المخزون</option><option value="available" ${bookStockFilter === 'available' ? 'selected' : ''}>متوفر</option><option value="empty" ${bookStockFilter === 'empty' ? 'selected' : ''}>غير متوفر</option></select><select id="owner-book-category"><option value="all">كل التصنيفات</option>${Object.entries(genres).map(([id, genre]) => `<option value="${esc(id)}" ${bookCategoryFilter === id ? 'selected' : ''}>${esc(genre.title)}</option>`).join('')}</select><button class="button button-outline" type="button" data-open-bulk-books>استيراد جماعي</button></div><div class="book-workspace-summary">${filtered.length} من ${books.length} كتاب · ${books.filter(book => Number(book.stock) > 0).length} متوفر</div><div class="book-admin-list">${filtered.length ? filtered.slice().reverse().map(book => `<article class="book-admin-card"><img src="${book.image?.startsWith('data:') ? book.image : `assets/covers/${book.image || 'meaning.jpg'}`}" alt="غلاف ${esc(book.title)}" /><div class="book-admin-main"><strong>${esc(book.title)}</strong><small>${esc(book.author)} · ${esc(book.publisher)}</small><p>${esc(book.review || book.note || 'لا توجد مراجعة قصيرة بعد.')}</p></div><div class="book-admin-price"><b>${money(book.price)}</b><span class="${Number(book.stock) > 0 ? 'stock-ok' : 'stock-off'}">${Number(book.stock) > 0 ? `${Number(book.stock)} نسخة` : 'غير متوفر'}</span><button class="text-button" type="button" data-edit-book="${esc(book.id)}">تعديل</button></div></article>`).join('') : '<p class="owner-note">لا توجد كتب تطابق البحث الحالي.</p>'}</div>`;
}
function renderDiscountWorkspace() {
  const list = $('#owner-list'); discounts = read('ghazal.discounts.v1', []);
  list.innerHTML = `<div class="discount-workspace-head"><div><strong>${discounts.filter(item => item.active !== false).length} خصم نشط</strong><small>تُعرض الخصومات التلقائية على الكتب، وتحتاج الرموز إلى إدخال العميل.</small></div><button class="button button-dark" type="button" data-owner-form="discount">إضافة خصم</button></div><div class="discount-admin-list">${discounts.length ? discounts.map(discount => `<article class="discount-admin-card"><span class="discount-badge">${discount.type === 'percent' ? `${Number(discount.value)}٪` : money(discount.value)}</span><div><strong>${esc(discount.name || 'خصم')}</strong><small>${discount.code ? `رمز الخصم: ${esc(discount.code)}` : 'خصم تلقائي'} · ${discount.appliesToAll ? 'كل الكتب' : `${(discount.bookIds || []).length} كتب`}</small></div><span class="${discount.active === false ? 'stock-off' : 'stock-ok'}">${discount.active === false ? 'متوقف' : 'نشط'}<button class="text-button discount-toggle" type="button" data-toggle-discount="${esc(discount.id)}">${discount.active === false ? 'تفعيل' : 'إيقاف'}</button></span></article>`).join('') : '<p class="owner-note">لم تضف أي خصومات بعد.</p>'}</div>`;
  list.querySelector('[data-owner-form="discount"]')?.addEventListener('click', () => openForm('discount'));
}
function renderUnavailableWorkspace() {
  const list = $('#owner-list'); const unavailable = books.filter(book => Number(book.stock) <= 0);
  list.innerHTML = `<div class="unavailable-full-head"><p class="eyebrow">المخزون</p><h3>كتب <em>غير متوفرة</em></h3><p>${unavailable.length ? 'هذه الكتب مخفية عن الشراء حتى تعيد تخزينها.' : 'لا توجد كتب ناقصة المخزون حاليًا.'}</p></div><div class="unavailable-full-list">${unavailable.length ? unavailable.map(book => `<article class="unavailable-full-card"><img src="${book.image?.startsWith('data:') ? book.image : `assets/covers/${book.image || 'meaning.jpg'}`}" alt="" /><div><strong>${esc(book.title)}</strong><small>${esc(book.author)} · ${esc(book.publisher)}</small></div><button class="button button-outline" type="button" data-edit-book="${esc(book.id)}">إعادة التخزين / تعديل</button></article>`).join('') : '<div class="empty-stock-state">كل الكتب متوفرة حاليًا.</div>'}</div>`;
}
function renderFeaturedWorkspace() {
  const list = $('#owner-list'); const current = featuredBookIds.map(id => books.find(book => book.id === id)).filter(Boolean);
  list.innerHTML = `<div class="featured-admin-intro"><p class="eyebrow">واجهة المتجر</p><h3>مختارات الغزال</h3><p>هذه هي الكتب الظاهرة في القسم التحريري على الصفحة الرئيسية. رتّب أربعة كتب كما تريد من زر التعديل.</p><button class="button button-dark" type="button" data-owner-form="featured">تعديل المختارات</button></div><div class="featured-admin-list">${current.map((book, index) => `<div class="featured-admin-row"><b>0${index + 1}</b><img src="${book.image?.startsWith('data:') ? book.image : `assets/covers/${book.image || 'meaning.jpg'}`}" alt="" /><span><strong>${esc(book.title)}</strong><small>${esc(book.author)}</small></span><em>${Number(book.stock) > 0 ? 'متوفر' : 'غير متوفر'}</em></div>`).join('')}</div>`;
  list.querySelector('[data-owner-form="featured"]')?.addEventListener('click', () => openForm('featured'));
}
function featuredBookMatches(query, slot) {
  const chosenElsewhere = new Set([...document.querySelectorAll('#owner-form input[name="featuredOrder"]')].filter(input => input.dataset.slot !== String(slot)).map(input => input.value).filter(Boolean));
  const needle = String(query || '').trim().toLocaleLowerCase('ar');
  return books.filter(book => !chosenElsewhere.has(book.id) && (!needle || `${book.title} ${book.author} ${book.publisher}`.toLocaleLowerCase('ar').includes(needle))).slice(0, 8);
}
function renderFeaturedPickerSuggestions(input) {
  const picker = input.closest('.featured-picker'); const menu = picker?.querySelector('.featured-picker-suggestions'); if (!menu) return;
  const matches = featuredBookMatches(input.value, input.dataset.slot);
  menu.innerHTML = matches.map(book => `<button type="button" data-featured-option="${esc(book.id)}"><img src="${book.image?.startsWith('data:') ? book.image : `assets/covers/${book.image || 'meaning.jpg'}`}" alt="" /><span><strong>${esc(book.title)}</strong><small>${esc(book.author)}</small></span></button>`).join('');
  menu.hidden = !matches.length;
}
function updateFeaturedPicker(input, bookId) {
  const picker = input.closest('.featured-picker'); const hidden = picker?.querySelector('input[name="featuredOrder"]'); const book = books.find(item => item.id === bookId); if (!picker || !hidden || !book) return;
  hidden.value = book.id; input.value = book.title;
  const selected = picker.querySelector('.featured-picker-selected'); selected.innerHTML = `<img src="${book.image?.startsWith('data:') ? book.image : `assets/covers/${book.image || 'meaning.jpg'}`}" alt="" /><span>${esc(book.author)} · ${esc(book.publisher)}</span><button type="button" data-clear-featured>تغيير</button>`; selected.hidden = false;
  picker.querySelector('.featured-picker-suggestions').hidden = true;
}
function setupFeaturedPickers() {
  const form = $('#owner-form'); if (!form) return;
  $$('.featured-picker-search', form).forEach(input => { input.addEventListener('input', () => renderFeaturedPickerSuggestions(input)); input.addEventListener('focus', () => renderFeaturedPickerSuggestions(input)); });
  form.addEventListener('click', event => {
    const option = event.target.closest('[data-featured-option]');
    if (option) { const input = option.closest('.featured-picker').querySelector('.featured-picker-search'); updateFeaturedPicker(input, option.dataset.featuredOption); return; }
    const clear = event.target.closest('[data-clear-featured]');
    if (clear) { const picker = clear.closest('.featured-picker'); const input = picker.querySelector('.featured-picker-search'); picker.querySelector('input[name="featuredOrder"]').value = ''; input.value = ''; picker.querySelector('.featured-picker-selected').hidden = true; renderFeaturedPickerSuggestions(input); input.focus(); }
  });
}
function renderEntitySuggestions(input) {
  const name = input.name; const target = input.parentElement.querySelector(`[data-suggestions-for="${name}"]`); if (!target) return;
  const values = name === 'author' ? [...new Set(books.map(book => book.author).filter(Boolean))] : [...new Set(publishers.map(publisher => publisher.name).filter(Boolean))];
  const query = input.value.trim().toLocaleLowerCase('ar'); const matches = values.filter(value => !query || value.toLocaleLowerCase('ar').includes(query)).slice(0, 8);
  target.innerHTML = matches.map(value => `<button type="button" data-suggestion-value="${esc(value)}">${esc(value)}</button>`).join(''); target.hidden = !matches.length;
  target.querySelectorAll('[data-suggestion-value]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.suggestionValue; target.hidden = true; input.focus(); }));
}
function deleteOrder(reference) {
  const order = orders.find(item => item.reference === reference); if (!order) return;
  if (!window.confirm(`حذف الطلب ${reference} نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
  orders = orders.filter(item => item.reference !== reference); save('ghazal.demoOrders.v1', orders); selectedOrderRefs.delete(reference); expandedOrderRefs.delete(reference); renderOwner();
}

function showOwnerApp() { $('#owner-login').hidden = true; $('#owner-app').hidden = false; renderOwner(); }
if (sessionStorage.getItem('ghazal.ownerSession') === 'open') showOwnerApp();
$('#owner-login-form').addEventListener('submit', event => { event.preventDefault(); if ($('#owner-code').value === OWNER_CODE) { sessionStorage.setItem('ghazal.ownerSession', 'open'); showOwnerApp(); } else { $('#owner-login-error').hidden = false; } });
$('#owner-logout').addEventListener('click', () => { sessionStorage.removeItem('ghazal.ownerSession'); location.reload(); });
function renderOwner() {
  orders = read('ghazal.demoOrders.v1', []);
  ensureDashboardPanels();
  $('#owner-order-count').textContent = orders.length;
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  $('#owner-revenue').textContent = money(revenue);
  $('#owner-book-count').textContent = books.length;
  const average = orders.length ? revenue / orders.length : 0;
  if ($('#owner-average-order')) $('#owner-average-order').textContent = money(Math.round(average));
  if ($('#owner-ecotrack-count')) $('#owner-ecotrack-count').textContent = orders.filter(order => order.ecotrackRow).length;
  const list = $('#owner-list');
  if (ownerTab === 'books') renderBooksWorkspace();
  if (ownerTab === 'publishers') list.innerHTML = publishers.map(publisher => `<div class="admin-row"><span class="admin-avatar">${publisher.logo?.startsWith('data:') ? `<img src="${publisher.logo}" alt="" />` : esc(publisher.logo || publisher.name.slice(0,1))}</span><div><strong>${esc(publisher.name)}</strong><small>${esc(publisher.city || '')}</small></div><span>نشط</span></div>`).join('');
  if (ownerTab === 'authors') list.innerHTML = [...new Set(books.map(book => book.author))].map(author => { const profile = authorProfiles[author]; return `<div class="admin-row"><span class="admin-avatar">${profile?.photo?.startsWith('data:') ? `<img src="${profile.photo}" alt="" />` : esc(author.slice(0,1))}</span><div><strong>${esc(author)}</strong><small>${books.filter(book => book.author === author).length} كتب ${profile ? '· ملف مضاف' : '· ملف اختياري'}</small></div><span>${profile?.featured ? 'مميز' : 'كاتب'}</span></div>`; }).join('');
  if (ownerTab === 'genres') list.innerHTML = Object.entries(genres).map(([id, genre]) => `<div class="admin-row"><span class="admin-avatar">✦</span><div><strong>${esc(genre.title)}</strong><small>#genre/${esc(id)} · ${esc(genre.description || '')}</small></div><span>${books.filter(book => book.category === id).length} كتب</span></div>`).join('');
  if (ownerTab === 'discounts') renderDiscountWorkspace();
  if (ownerTab === 'featured') renderFeaturedWorkspace();
  if (ownerTab === 'unavailable') renderUnavailableWorkspace();
  if (ownerTab === 'orders') renderOrderWorkspace();
  renderRecentOrders();
}
$$('[data-owner-tab]').forEach(button => button.addEventListener('click', () => { ownerTab = button.dataset.ownerTab; $$('.admin-tabs button').forEach(item => item.classList.toggle('active', item === button)); renderOwner(); }));
function openForm(kind, editId = '') {
  $('#owner-form-title').textContent = kind === 'book' ? 'إضافة كتاب جديد' : kind === 'publisher' ? 'إضافة دار نشر' : kind === 'author' ? 'إضافة ملف مؤلف اختياري' : 'إضافة تصنيف جديد';
  $('#owner-form').innerHTML = kind === 'book' ? `<div class="form-grid"><label>عنوان الكتاب<input name="title" required /></label><label>المؤلف<input name="author" required /></label></div><div class="form-grid"><label>دار النشر<input name="publisher" required /></label><label>السعر بالدينار<input name="price" type="number" min="0" required /></label></div><div class="form-grid"><label>التصنيف<select name="category">${Object.entries(genres).map(([id, genre]) => `<option value="${id}">${esc(genre.title)}</option>`).join('')}</select></label><label>التصنيف الفرعي<input name="genre" required placeholder="رواية مترجمة" /></label></div><label>نبذة<textarea name="note" rows="3" required></textarea></label><label class="bulk-drop">غلاف الكتاب<input name="cover" type="file" accept="image/*" /></label><button class="button button-dark" type="submit">حفظ الكتاب</button>` : kind === 'publisher' ? `<div class="form-grid"><label>اسم دار النشر<input name="name" required /></label><label>المدينة<input name="city" required /></label></div><label>الوصف<textarea name="description" rows="3" required></textarea></label><label class="bulk-drop">شعار دار النشر<input name="logo" type="file" accept="image/*" required /></label><button class="button button-dark" type="submit">حفظ دار النشر</button>` : kind === 'author' ? `<label>اسم المؤلف<input name="name" required placeholder="يجب أن يطابق اسم المؤلف في الكتب" /></label><label>نبذة المؤلف<textarea name="bio" rows="4" placeholder="نبذة قصيرة تظهر في الصفحة العامة"></textarea></label><label class="bulk-drop">صورة المؤلف<input name="photo" type="file" accept="image/*" /></label><label><input name="featured" type="checkbox" /> أظهره كاختيار مميز</label><button class="button button-dark" type="submit">حفظ ملف المؤلف</button>` : `<div class="form-grid"><label>معرّف التصنيف<input name="id" required placeholder="مثال: poetry" pattern="[a-z0-9-]+" /></label><label>اسم التصنيف<input name="title" required placeholder="الشعر" /></label></div><label>وصف مختصر<textarea name="description" rows="3" required></textarea></label><button class="button button-dark" type="submit">حفظ التصنيف</button>`;
  $('#owner-form').dataset.kind = kind; $('#owner-form').dataset.editId = editId;
  if (kind === 'book' && editId) $('#owner-form-title').textContent = 'تعديل بيانات الكتاب';
  if (kind === 'book') {
    const book = books.find(item => item.id === editId);
    $('#owner-form').querySelector('textarea[name="note"]')?.closest('label')?.insertAdjacentHTML('afterend', '<label>مراجعة قصيرة للكتاب<textarea name="review" rows="5" maxlength="1200" placeholder="اكتب 5 إلى 10 أسطر عن تجربة قراءة هذا الكتاب"></textarea><small class="field-hint">حد أقصى 1200 حرفًا.</small></label>');
    $('#owner-form').insertAdjacentHTML('beforeend', `<label>الكمية المتوفرة<input name="stock" type="number" min="0" step="1" value="${esc(book?.stock ?? 10)}" /></label><label class="bulk-drop">إضافة عدة كتب عبر CSV<input name="bulk" type="file" accept=".csv,text/csv" /></label><small class="form-help">الأعمدة: العنوان، المؤلف، الناشر، السعر، التصنيف، التصنيف الفرعي، النبذة، الكمية.</small>`);
    ['author','publisher'].forEach(name => { const input = $('#owner-form').elements[name]; input.classList.add('entity-autocomplete'); input.setAttribute('autocomplete', 'off'); input.insertAdjacentHTML('afterend', `<div class="entity-suggestions" data-suggestions-for="${name}" hidden></div>`); input.addEventListener('input', () => renderEntitySuggestions(input)); input.addEventListener('focus', () => renderEntitySuggestions(input)); });
    if (book) ['title','author','publisher','price','category','genre','note','review','stock'].forEach(name => { if (book[name] !== undefined && $('#owner-form').elements[name]) $('#owner-form').elements[name].value = book[name]; });
    $('#owner-form').elements.bulk.addEventListener('change', event => { ['title','author','publisher','price','category','genre','note'].forEach(name => { if ($('#owner-form').elements[name]) $('#owner-form').elements[name].required = !event.target.files.length; }); });
  }
  if (kind === 'discount') {
    $('#owner-form-title').textContent = 'إضافة خصم';
    $('#owner-form').innerHTML = `<label>اسم الخصم<input name="name" required placeholder="خصم الصيف" /></label><div class="form-grid"><label>نوع الخصم<select name="type"><option value="percent">نسبة مئوية</option><option value="fixed">مبلغ ثابت بالدينار</option></select></label><label>قيمة الخصم<input name="value" type="number" min="0" step="0.01" required /></label></div><label>رمز الخصم (اختياري)<input name="code" maxlength="40" placeholder="مثال: GHazal10" /></label><label class="discount-all-toggle"><input name="appliesToAll" type="checkbox" /> طبّق الخصم على كل الكتب</label><fieldset class="discount-book-picker"><legend>أو اختر الكتب المشمولة</legend>${books.map(book => `<label><input type="checkbox" name="bookIds" value="${esc(book.id)}" /> <span>${esc(book.title)}</span></label>`).join('')}</fieldset><label class="discount-all-toggle"><input name="active" type="checkbox" checked /> الخصم نشط الآن</label><button class="button button-dark" type="submit">حفظ الخصم</button>`;
  }
  if (kind === 'featured') {
    $('#owner-form-title').textContent = 'تعديل مختارات الغزال';
    $('#owner-form').innerHTML = `<p class="form-help">ابحث داخل كل خانة بعنوان الكتاب أو المؤلف أو دار النشر. يمكنك ترك الخانة فارغة، ولا يمكن تكرار الكتاب في أكثر من موضع.</p>${[0,1,2,3].map(index => { const selected = books.find(book => book.id === featuredBookIds[index]); return `<div class="featured-picker" data-slot="${index}"><label for="featured-search-${index}">الخانة ${index + 1}<input id="featured-search-${index}" class="featured-picker-search" type="search" autocomplete="off" placeholder="ابحث عن كتاب…" value="${esc(selected?.title || '')}" data-slot="${index}" /></label><input type="hidden" name="featuredOrder" value="${esc(selected?.id || '')}" data-slot="${index}" /><div class="featured-picker-suggestions" role="listbox" hidden></div><div class="featured-picker-selected" ${selected ? '' : 'hidden'}><img src="${selected ? (selected.image?.startsWith('data:') ? selected.image : `assets/covers/${selected.image || 'meaning.jpg'}`) : ''}" alt="" /><span>${selected ? `${esc(selected.author)} · ${esc(selected.publisher)}` : ''}</span><button type="button" data-clear-featured>تغيير</button></div></div>`; }).join('')}<button class="button button-dark" type="submit">حفظ المختارات</button>`;
    setupFeaturedPickers();
  }
  $('#owner-form-overlay').hidden = false; $('#owner-form').querySelector('input')?.focus();
}
$$('[data-owner-form]').forEach(button => button.addEventListener('click', () => openForm(button.dataset.ownerForm)));
$('#owner-form-close').addEventListener('click', () => { $('#owner-form-overlay').hidden = true; });
$('#owner-form-overlay').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.hidden = true; });
function fileData(input) { return new Promise(resolve => { const file = input?.files?.[0]; if (!file) return resolve(''); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }); }
const BULK_BOOK_FIELDS = [
  { id:'title', label:'العنوان', required:true, aliases:['title','العنوان','اسم الكتاب','book title'] },
  { id:'author', label:'المؤلف', required:true, aliases:['author','المؤلف','الكاتب'] },
  { id:'publisher', label:'الناشر', required:true, aliases:['publisher','الناشر','دار النشر'] },
  { id:'price', label:'السعر', required:true, aliases:['price','السعر','الثمن','prix'] },
  { id:'category', label:'التصنيف العام', aliases:['category','التصنيف','القسم'] },
  { id:'genre', label:'التصنيف الفرعي', aliases:['genre','التصنيف الفرعي','النوع'] },
  { id:'review', label:'المراجعة القصيرة', aliases:['review','المراجعة','مراجعة','نبذة'] },
  { id:'stock', label:'الكمية / المخزون', aliases:['stock','quantity','qty','الكمية','المخزون','الكمية المتوفرة'] },
  { id:'note', label:'ملاحظات داخلية', aliases:['note','notes','ملاحظات'] },
  { id:'image', label:'صورة الغلاف', aliases:['image','cover','الغلاف','رابط الغلاف'] }
];
function normalizeColumn(value) { return String(value || '').trim().toLocaleLowerCase('ar').replace(/[._-]+/g, ' '); }
function parseDelimitedText(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < String(text).length; index += 1) { const char = text[index]; const next = text[index + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (!quoted && (char === ',' || char === '\t')) { row.push(cell.trim()); cell = ''; } else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && next === '\n') index += 1; row.push(cell.trim()); if (row.some(value => value !== '')) rows.push(row); row = []; cell = ''; } else cell += char; }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(value => value !== '')) rows.push(row); } return rows;
}
function columnIndex(reference) { const letters = String(reference || '').replace(/\d/g, ''); return [...letters].reduce((sum, letter) => sum * 26 + letter.toUpperCase().charCodeAt(0) - 64, 0) - 1; }
async function parseXlsxRows(file) {
  const entries = parseZip(await file.arrayBuffer()); const sheet = entries.find(entry => entry.name === 'xl/worksheets/sheet1.xml'); if (!sheet) throw new Error('sheet');
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(await inflateZip(sheet.data, sheet.method)), 'application/xml');
  const sharedEntry = entries.find(entry => entry.name === 'xl/sharedStrings.xml'); const shared = sharedEntry ? [...new DOMParser().parseFromString(new TextDecoder().decode(await inflateZip(sharedEntry.data, sharedEntry.method)), 'application/xml').querySelectorAll('si')].map(item => item.textContent || '') : [];
  return [...xml.querySelectorAll('sheetData > row')].map(row => { const values = []; [...row.children].filter(cell => cell.localName === 'c').forEach(cell => { const index = columnIndex(cell.getAttribute('r')); const type = cell.getAttribute('t'); const raw = type === 'inlineStr' ? cell.querySelector('is')?.textContent || '' : cell.querySelector('v')?.textContent || ''; values[index] = type === 's' ? (shared[Number(raw)] || '') : raw; }); return values.map(value => value ?? ''); });
}
async function parseBookSpreadsheet(file) { const name = String(file?.name || '').toLowerCase(); return name.endsWith('.xlsx') ? parseXlsxRows(file) : parseDelimitedText(await readFileText({ files:[file] })); }
function autoBulkMapping(headers) { const normalized = headers.map(normalizeColumn); return Object.fromEntries(BULK_BOOK_FIELDS.map(field => [field.id, normalized.findIndex(header => field.aliases.some(alias => normalizeColumn(alias) === header))]).map(([id, index]) => [id, index >= 0 ? String(index) : ''])); }
function ensureBulkBookOverlay() {
  if ($('#bulk-book-overlay')) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="overlay admin-overlay" id="bulk-book-overlay" hidden><div class="form-panel bulk-import-panel" role="dialog" aria-modal="true"><button class="close-button" type="button" data-close-bulk>×</button><p class="eyebrow">الغزال / استيراد الكتب</p><h2>أضف رفًا <em>كاملًا.</em></h2><p class="owner-copy">ارفع CSV أو TSV أو XLSX، ثم اربط كل عمود بالحقل المناسب قبل الحفظ. الحقول الإلزامية مميزة بوضوح، ويمكن مراجعة أول الصفوف قبل الاستيراد.</p><label class="bulk-upload-zone">اختر ملف spreadsheet<input id="bulk-book-file" type="file" accept=".csv,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /><small id="bulk-book-file-name">لم يتم اختيار ملف</small></label><div id="bulk-book-mapping"></div><div class="bulk-import-actions"><button class="button button-dark" id="bulk-book-import" type="button" disabled>استيراد الكتب</button><button class="text-button" type="button" data-close-bulk>إلغاء</button></div></div></div>`);
  $('#bulk-book-file').addEventListener('change', async event => { const file = event.target.files?.[0]; if (!file) return; $('#bulk-book-file-name').textContent = file.name; $('#bulk-book-mapping').innerHTML = '<p class="owner-note">جارٍ قراءة الملف…</p>'; try { const rows = await parseBookSpreadsheet(file); if (rows.length < 2) throw new Error('empty'); bulkBookHeaders = rows[0].map((value, index) => String(value || `العمود ${index + 1}`)); bulkBookRows = rows.slice(1); bulkBookMapping = autoBulkMapping(bulkBookHeaders); renderBulkBookMapping(); } catch (error) { $('#bulk-book-mapping').innerHTML = '<p class="bulk-error">تعذر قراءة الملف. استخدم CSV أو TSV أو XLSX سليمًا، ويجب أن يكون الصف الأول عناوين الأعمدة.</p>'; $('#bulk-book-import').disabled = true; console.error(error); } });
  $('#bulk-book-mapping').addEventListener('change', event => { if (event.target.matches('[data-bulk-map]')) { bulkBookMapping[event.target.dataset.bulkMap] = event.target.value; renderBulkBookMapping(); } });
  $('#bulk-book-import').addEventListener('click', importMappedBooks);
  $$('[data-close-bulk]').forEach(button => button.addEventListener('click', () => { $('#bulk-book-overlay').hidden = true; }));
}
function renderBulkBookMapping() {
  const options = `<option value="">— لا يوجد عمود —</option>${bulkBookHeaders.map((header, index) => `<option value="${index}">${esc(header)}</option>`).join('')}`;
  const mapping = BULK_BOOK_FIELDS.map(field => `<label class="bulk-map-row"><span>${field.label}${field.required ? ' <b>*</b>' : ''}</span><select data-bulk-map="${field.id}">${options}</select></label>`).join('');
  const preview = bulkBookRows.slice(0, 4).map(row => `<tr>${bulkBookHeaders.map((_, index) => `<td>${esc(row[index] || '')}</td>`).join('')}</tr>`).join('');
  $('#bulk-book-mapping').innerHTML = `<div class="bulk-map-grid"><h3>طابق الأعمدة مع بيانات الكتاب</h3>${mapping}</div><div class="bulk-preview"><h3>معاينة ${bulkBookRows.length} صف</h3><div class="bulk-preview-scroll"><table><thead><tr>${bulkBookHeaders.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${preview}</tbody></table></div></div>`;
  BULK_BOOK_FIELDS.forEach(field => { const select = $(`[data-bulk-map="${field.id}"]`); select.value = bulkBookMapping[field.id] || ''; });
  $('#bulk-book-import').disabled = !BULK_BOOK_FIELDS.filter(field => field.required).every(field => bulkBookMapping[field.id] !== '');
}
function openBulkBooks() { ensureBulkBookOverlay(); $('#bulk-book-overlay').hidden = false; $('#bulk-book-file').value = ''; $('#bulk-book-file-name').textContent = 'لم يتم اختيار ملف'; $('#bulk-book-mapping').innerHTML = '<p class="owner-note">ابدأ باختيار ملف spreadsheet.</p>'; $('#bulk-book-import').disabled = true; }
function bulkValue(row, field) { const index = bulkBookMapping[field]; return index === '' || index === undefined ? '' : String(row[Number(index)] ?? '').trim(); }
function importMappedBooks() {
  const missing = []; const imported = [];
  bulkBookRows.forEach((row, rowIndex) => { const values = Object.fromEntries(BULK_BOOK_FIELDS.map(field => [field.id, bulkValue(row, field)])); const requiredMissing = BULK_BOOK_FIELDS.filter(field => field.required && !values[field.id]); if (requiredMissing.length) { missing.push(rowIndex + 2); return; } const price = Number(values.price.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0; const stock = Math.max(0, Number(values.stock.replace(/[^\d-]/g, '')) || 0); imported.push({ id:`book-${Date.now()}-${rowIndex}`, title:values.title, author:values.author, publisher:values.publisher, price, category:values.category || 'literature', genre:values.genre || 'كتاب', review:values.review.slice(0, 1200), note:values.note, stock, image:values.image || 'meaning.jpg' }); });
  if (missing.length) { alert(`هناك صفوف ناقصة في الحقول الإلزامية: ${missing.slice(0, 8).join('، ')}${missing.length > 8 ? '…' : ''}`); return; }
  const current = read('ghazal.customBooks.v1', []); save('ghazal.customBooks.v1', [...current, ...imported]); $('#bulk-book-overlay').hidden = true; location.reload();
}
function readFileText(input) { return new Promise(resolve => { const file = input?.files?.[0]; if (!file) return resolve(''); const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(file); }); }
function csvBookRows(text) { return String(text).split(/\r?\n/).filter(Boolean).slice(1).map(row => row.split(',').map(value => value.trim())).filter(values => values.length >= 4); }
$('#owner-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  if (form.dataset.kind === 'publisher') { const name = data.get('name'); const publisher = { id:`publisher-${Date.now()}`, name, city:data.get('city'), since:'إضافة جديدة', description:data.get('description'), logo:await fileData(form.elements.logo) }; const current = read('ghazal.customPublishers.v1', []); save('ghazal.customPublishers.v1', [...current, publisher]); }
  else if (form.dataset.kind === 'author') { const name = data.get('name').trim(); const profiles = read('ghazal.authorProfiles.v1', {}); profiles[name] = { bio:data.get('bio'), photo:await fileData(form.elements.photo), featured:data.get('featured') === 'on' }; save('ghazal.authorProfiles.v1', profiles); }
  else if (form.dataset.kind === 'genre') { const id = data.get('id').trim(); const custom = read('ghazal.genres.v1', {}); custom[id] = { title:data.get('title').trim(), description:data.get('description').trim() }; save('ghazal.genres.v1', custom); }
  else if (form.dataset.kind === 'discount') { const appliesToAll = data.get('appliesToAll') === 'on'; const bookIds = [...form.querySelectorAll('input[name="bookIds"]:checked')].map(input => input.value); if (!appliesToAll && !bookIds.length) { alert('اختر كتابًا واحدًا على الأقل أو فعّل تطبيق الخصم على كل الكتب.'); return; } const value = Math.max(0, Number(data.get('value')) || 0); if (data.get('type') === 'percent' && value > 100) { alert('النسبة لا يمكن أن تتجاوز 100٪.'); return; } discounts = [...read('ghazal.discounts.v1', []), { id:`discount-${Date.now()}`, name:data.get('name').trim(), type:data.get('type'), value, code:String(data.get('code') || '').trim().toUpperCase(), appliesToAll, bookIds, active:data.get('active') === 'on' }]; save('ghazal.discounts.v1', discounts); }
  else if (form.dataset.kind === 'featured') { const selected = [...form.querySelectorAll('input[name="featuredOrder"]')].map(input => input.value).filter(Boolean); if (new Set(selected).size !== selected.length) { alert('اختر كتابًا مختلفًا في كل خانة.'); return; } featuredBookIds = selected; save('ghazal.featuredBooks.v1', featuredBookIds); }
  else {
    const bulkRows = await readFileText(form.elements.bulk); const current = read('ghazal.customBooks.v1', []);
    if (bulkRows) {
      const added = csvBookRows(bulkRows).map((values, index) => ({ id:`book-${Date.now()}-${index}`, title:values[0], author:values[1], publisher:values[2], price:Number(values[3]) || 0, category:values[4] || 'literature', genre:values[5] || 'كتاب', review:values[6] || '', note:values[6] || 'كتاب جديد على رفوف الغزال.', stock:Math.max(0, Number(values[7]) || 0), image:'meaning.jpg' }));
      save('ghazal.customBooks.v1', [...current, ...added]);
    } else {
      const id = form.dataset.editId || `book-${Date.now()}`; const existing = books.find(book => book.id === id) || {}; const book = { ...existing, id, title:data.get('title'), author:data.get('author'), publisher:data.get('publisher'), price:Number(data.get('price')) || 0, category:data.get('category'), genre:data.get('genre'), note:data.get('note'), review:String(data.get('review') || existing.review || '').slice(0, 1200), stock:Math.max(0, Number(data.get('stock')) || 0), image:await fileData(form.elements.cover) || existing.image || 'meaning.jpg' }; const next = current.filter(item => item.id !== id); save('ghazal.customBooks.v1', [...next, book]);
    }
  }
  $('#owner-form-overlay').hidden = true; location.reload();
});
const TEMPLATE_URL = 'assets/templates/upload_ecotrack_v31.xlsx';
const zipU16 = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8);
const zipU32 = (bytes, offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
const putU16 = (view, offset, value) => view.setUint16(offset, value, true);
const putU32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
async function streamBytes(stream, bytes) { const output = new Response(stream.readable).arrayBuffer(); const writer = stream.writable.getWriter(); await writer.write(bytes); await writer.close(); return new Uint8Array(await output); }
async function inflateZip(bytes, method) { return method === 0 ? bytes : new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }
async function deflateZip(bytes) { return streamBytes(new CompressionStream('deflate-raw'), bytes); }
function parseZip(buffer) {
  const bytes = new Uint8Array(buffer); let eocd = bytes.length - 22;
  while (eocd >= 0 && zipU32(bytes, eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('لم نتمكن من قراءة ملف Ecotrack.');
  const count = zipU16(bytes, eocd + 10); const centralOffset = zipU32(bytes, eocd + 16); const entries = []; let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (zipU32(bytes, cursor) !== 0x02014b50) throw new Error('بنية ملف Ecotrack غير متوقعة.');
    const nameLength = zipU16(bytes, cursor + 28); const extraLength = zipU16(bytes, cursor + 30); const commentLength = zipU16(bytes, cursor + 32); const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)); const localOffset = zipU32(bytes, cursor + 42); const localNameLength = zipU16(bytes, localOffset + 26); const localExtraLength = zipU16(bytes, localOffset + 28); const dataStart = localOffset + 30 + localNameLength + localExtraLength; const compressedSize = zipU32(bytes, cursor + 20);
    entries.push({ name, method: zipU16(bytes, cursor + 10), time: zipU16(bytes, cursor + 12), date: zipU16(bytes, cursor + 14), crc: zipU32(bytes, cursor + 16), uncompressedSize: zipU32(bytes, cursor + 24), data: bytes.slice(dataStart, dataStart + compressedSize) }); cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function zipBytes(entries) {
  const chunks = []; const central = []; let offset = 0; const encoder = new TextEncoder();
  entries.forEach(entry => { const name = encoder.encode(entry.name); const local = new Uint8Array(30 + name.length + entry.data.length); const view = new DataView(local.buffer); putU32(view, 0, 0x04034b50); putU16(view, 4, 20); putU16(view, 6, 0); putU16(view, 8, entry.method); putU16(view, 10, entry.time); putU16(view, 12, entry.date); putU32(view, 14, entry.crc); putU32(view, 18, entry.data.length); putU32(view, 22, entry.uncompressedSize ?? entry.data.length); putU16(view, 26, name.length); putU16(view, 28, 0); local.set(name, 30); local.set(entry.data, 30 + name.length); chunks.push(local); const record = new Uint8Array(46 + name.length); const recordView = new DataView(record.buffer); putU32(recordView, 0, 0x02014b50); putU16(recordView, 4, 20); putU16(recordView, 6, 20); putU16(recordView, 8, 0); putU16(recordView, 10, entry.method); putU16(recordView, 12, entry.time); putU16(recordView, 14, entry.date); putU32(recordView, 16, entry.crc); putU32(recordView, 20, entry.data.length); putU32(recordView, 24, entry.uncompressedSize ?? entry.data.length); putU16(recordView, 28, name.length); putU16(recordView, 30, 0); putU16(recordView, 32, 0); putU16(recordView, 34, 0); putU16(recordView, 36, 0); putU32(recordView, 38, 0); putU32(recordView, 42, offset); record.set(name, 46); central.push(record); offset += local.length; });
  const centralSize = central.reduce((sum, item) => sum + item.length, 0); const end = new Uint8Array(22); const endView = new DataView(end.buffer); putU32(endView, 0, 0x06054b50); putU16(endView, 8, entries.length); putU16(endView, 10, entries.length); putU32(endView, 12, centralSize); putU32(endView, 16, offset); return new Blob([...chunks, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const xmlEscape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[character]));
function workbookRows(exportable) { return exportable.map(order => { const row = order.ecotrackRow; return ECOTRACK_COLUMNS.map(column => row[column] ?? ''); }); }
function makeSheetRows(rows, start = 2) { return rows.map((values, rowIndex) => { const number = start + rowIndex; return `<row r="${number}" spans="1:18" ht="15.75" customHeight="1" x14ac:dyDescent="0.2">${values.map((value, index) => { const reference = String.fromCharCode(65 + index) + number; const numeric = index === 4 || index === 9 || index === 10; return numeric ? `<c r="${reference}" s="4" t="n"><v>${Number(value) || 0}</v></c>` : `<c r="${reference}" s="4" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`; }).join('')}</row>`; }).join(''); }
async function exportOrders() {
  orders = read('ghazal.demoOrders.v1', []);
  const visible = filteredOrders().filter(order => order.ecotrackRow);
  const exportable = selectedOrderRefs.size ? visible.filter(order => selectedOrderRefs.has(order.reference)) : visible;
  if (!exportable.length) return alert(selectedOrderRefs.size ? 'لا توجد طلبات محددة جاهزة للتصدير ضمن نطاق التاريخ.' : 'لا توجد طلبات Ecotrack جاهزة للتصدير ضمن نطاق التاريخ.');
  try {
    let templateBuffer;
    if (window.GHAZAL_ECOTRACK_TEMPLATE_BASE64) {
      const binary = atob(window.GHAZAL_ECOTRACK_TEMPLATE_BASE64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      templateBuffer = bytes.buffer;
    } else {
      const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('template');
      templateBuffer = await response.arrayBuffer();
    }
    const entries = parseZip(templateBuffer); const sheetEntry = entries.find(entry => entry.name === 'xl/worksheets/sheet1.xml'); if (!sheetEntry) throw new Error('sheet');
    const sheetXml = new TextDecoder().decode(await inflateZip(sheetEntry.data, sheetEntry.method)); const rowXml = makeSheetRows(workbookRows(exportable)); const sheetDataStart = sheetXml.indexOf('<sheetData'); const firstRowEnd = sheetXml.indexOf('</row>', sheetDataStart); const sheetDataEnd = sheetXml.indexOf('</sheetData>'); if (sheetDataStart < 0 || firstRowEnd < 0 || sheetDataEnd < 0) throw new Error('sheetData');
    const endOfHeader = firstRowEnd + '</row>'.length; const updatedXml = sheetXml.slice(0, endOfHeader) + rowXml + sheetXml.slice(sheetDataEnd); const updatedSheet = new TextEncoder().encode(updatedXml); const compressed = await deflateZip(updatedSheet); sheetEntry.method = 8; sheetEntry.data = compressed; sheetEntry.crc = crc32(updatedSheet); sheetEntry.uncompressedSize = updatedSheet.length;
    const workbook = zipBytes(entries); const link = document.createElement('a'); link.href = URL.createObjectURL(workbook); link.download = `upload_ecotrack_v31-${new Date().toISOString().slice(0,10)}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) { alert('تعذّر تجهيز ملف Ecotrack. تأكد من استخدام متصفح حديث ثم حاول مرة أخرى.'); console.error(error); }
}
$('#owner-export').addEventListener('click', exportOrders);
$('#owner-list').addEventListener('click', event => {
  const toggleDiscount = event.target.closest('[data-toggle-discount]');
  if (toggleDiscount) { const id = toggleDiscount.dataset.toggleDiscount; discounts = read('ghazal.discounts.v1', []).map(discount => discount.id === id ? { ...discount, active: discount.active === false } : discount); save('ghazal.discounts.v1', discounts); renderOwner(); return; }
  const editBook = event.target.closest('[data-edit-book]');
  if (editBook) { openForm('book', editBook.dataset.editBook); return; }
  if (event.target.closest('[data-open-bulk-books]')) { openBulkBooks(); return; }
  const toggle = event.target.closest('[data-order-toggle]');
  if (toggle) { const reference = toggle.dataset.orderToggle; expandedOrderRefs.has(reference) ? expandedOrderRefs.delete(reference) : expandedOrderRefs.add(reference); renderOwner(); return; }
  const remove = event.target.closest('[data-order-delete]');
  if (remove) { deleteOrder(remove.dataset.orderDelete); return; }
  if (event.target.closest('[data-order-clear-filter]')) { orderStartDate = ''; orderEndDate = ''; renderOwner(); return; }
  if (event.target.closest('[data-order-select-visible]')) { const visible = filteredOrders(); const allSelected = visible.length > 0 && visible.every(order => selectedOrderRefs.has(order.reference)); visible.forEach(order => allSelected ? selectedOrderRefs.delete(order.reference) : selectedOrderRefs.add(order.reference)); renderOwner(); return; }
  if (event.target.closest('[data-order-clear-selection]')) { selectedOrderRefs.clear(); renderOwner(); }
  if (event.target.closest('[data-order-export]')) { exportOrders(); }
});
$('#owner-list').addEventListener('change', event => {
  if (event.target.id === 'owner-book-search') { bookQuery = event.target.value; renderBooksWorkspace(); return; }
  if (event.target.id === 'owner-book-stock') { bookStockFilter = event.target.value; renderBooksWorkspace(); return; }
  if (event.target.id === 'owner-book-category') { bookCategoryFilter = event.target.value; renderBooksWorkspace(); return; }
  if (event.target.matches('[data-order-select]')) { const reference = event.target.dataset.orderSelect; event.target.checked ? selectedOrderRefs.add(reference) : selectedOrderRefs.delete(reference); renderOrderWorkspace(); }
  if (event.target.id === 'order-start-date') { orderStartDate = event.target.value; renderOrderWorkspace(); }
  if (event.target.id === 'order-end-date') { orderEndDate = event.target.value; renderOrderWorkspace(); }
});
window.addEventListener('storage', event => { if (event.key === 'ghazal.demoOrders.v1' || event.key === 'ghazal.customBooks.v1' || event.key === 'ghazal.customPublishers.v1' || event.key === 'ghazal.featuredBooks.v1') renderOwner(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderOwner(); });
