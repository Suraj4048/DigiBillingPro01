// --- UTILS ---
function safeGet(k){try{return JSON.parse(localStorage.getItem(k))||[]}catch(e){return[]}}
function safeSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

// --- STATE ---
var DB={parties:safeGet('bp_parties'),items:safeGet('bp_items'),invoices:safeGet('bp_invoices'),quotations:safeGet('bp_quotations'),templates:safeGet('bp_templates'),purchases:safeGet('bp_purchases'),payments:safeGet('bp_payments'),settings:safeGet('bp_settings')||{compName:'',compMobile:'',compEmail:'',compGst:'',compWeb:'',compSocial:'',bankName:'',bankAcc:'',bankIfsc:'',bankBranch:'',logo:'',terms:'',notes:'',signature:''}};
var currentDocType='invoice',currentDocItems=[],currentDocAdvances=[],currentDiscount=0,editingId=null,currentLedgerParty=null,editingItemId=null,continueToDoc=0,exploreContext=null,currentScreenBase64='',editingInvoiceId=null;

var $=function(id){return document.getElementById(id)};
var toast=function(msg,type){type=type||'success';var t=document.createElement('div');t.className='toast '+type;t.textContent=(type==='success'?'✅ ':'❌ ')+msg;$('toastContainer').appendChild(t);setTimeout(function(){t.remove()},3000)};
var openModal=function(id){$(id).classList.add('active')};
var closeModal=function(id){$(id).classList.remove('active')};
var fmt=function(n){return '₹'+parseFloat(n||0).toFixed(2)};
var today=function(){return new Date().toISOString().split('T')[0]};
var getPartyById=function(id){for(var i=0;i<DB.parties.length;i++){if(DB.parties[i].id===id)return DB.parties[i]}return null};
var getItemById=function(id){for(var i=0;i<DB.items.length;i++){if(DB.items[i].id===id)return DB.items[i]}return null};
var getPartyBalance=function(partyId){var debits=0,credits=0;for(var i=0;i<DB.invoices.length;i++){if(DB.invoices[i].partyId===partyId)debits+=DB.invoices[i].grandTotal}for(var i=0;i<DB.payments.length;i++){if(DB.payments[i].partyId===partyId)credits+=DB.payments[i].amount}return debits-credits};
var hasPendingQuotation=function(partyId){for(var i=0;i<DB.quotations.length;i++){if(DB.quotations[i].partyId===partyId&&DB.quotations[i].status!=='Converted'){return DB.quotations[i]}}return null};

// Number to Words (Indian System)
function numToWords(num) {
    if (!num || num == 0) return "Zero Rupees Only";
    var a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    var b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    var n = num.toString().split('.');
    var numStr = n[0].padStart(9, '0');
    var crores = numStr.substring(0, 2);
    var lakhs = numStr.substring(2, 4);
    var thousands = numStr.substring(4, 6);
    var hundreds = numStr.substring(6, 7);
    var tens = numStr.substring(7, 9);
    var words = "";
    if (crores != '00') words += (crores > 19 ? b[Math.floor(crores/10)] + " " + a[crores%10] : a[crores]) + "Crore ";
    if (lakhs != '00') words += (lakhs > 19 ? b[Math.floor(lakhs/10)] + " " + a[lakhs%10] : a[lakhs]) + "Lakh ";
    if (thousands != '00') words += (thousands > 19 ? b[Math.floor(thousands/10)] + " " + a[thousands%10] : a[thousands]) + "Thousand ";
    if (hundreds != '0') words += a[hundreds] + "Hundred ";
    if (tens != '00') words += (tens > 19 ? b[Math.floor(tens/10)] + " " + a[tens%10] : a[tens]);
    words = words.trim() + " Rupees";
    if (n.length > 1 && n[1] != '00') {
        var paise = n[1].padEnd(2, '0').substring(0, 2);
        words += " and " + (paise > 19 ? b[Math.floor(paise/10)] + " " + a[paise%10] : a[paise]) + "Paise";
    }
    return words + " Only";
}

// --- FAST AUTO-UPDATE ---
function refreshUI() {
    updateDashboard();
    renderAllTables();
    renderTemplates();
    if(currentLedgerParty && $('ledgerContent').style.display !== 'none') {
        renderLedger();
    }
}

// --- AUTH ---
$('btnLogin').onclick = function() {
    if($('logEmail').value === 'surajanandpbh@gmail.com' && $('logPass').value === ':@Suraj4048') {
        localStorage.setItem('dbp_logged_in', 'true');
        $('authScreen').style.display = 'none';
        $('appLayout').style.display = 'flex';
        initApp();
        toast('Login Successful!');
    } else {
        toast('Invalid Username or Password', 'error');
    }
};

$('btnLogout').onclick = function() {
    if(confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('dbp_logged_in');
        location.reload();
    }
};

if(localStorage.getItem('dbp_logged_in') === 'true') {
    $('authScreen').style.display = 'none';
    $('appLayout').style.display = 'flex';
    document.addEventListener('DOMContentLoaded', initApp);
}

// --- NAVIGATION ---
var navBtns=document.querySelectorAll('.nav-btn');
for(var i=0;i<navBtns.length;i++){navBtns[i].onclick=function(){for(var j=0;j<navBtns.length;j++)navBtns[j].classList.remove('active');this.classList.add('active');var sections=document.querySelectorAll('.section');for(var k=0;k<sections.length;k++)sections[k].classList.remove('active');var target=this.getAttribute('data-target');if($(target))$(target).classList.add('active');$('sidebar').classList.remove('open');if(target==='dashboard')updateDashboard();if(target==='ledger')initLedger();if(target==='templates')renderTemplates()}}
$('mobileToggle').onclick = function(){$('sidebar').classList.toggle('open')};
$('backBtn').onclick = function(){$('sidebar').classList.remove('open');navigateTo('dashboard')};
var closeBtns=document.querySelectorAll('[data-close]');
for(var m=0;m<closeBtns.length;m++){closeBtns[m].onclick=function(){closeModal(this.getAttribute('data-close'))}}

function navigateTo(targetId){
    var navBtns=document.querySelectorAll('.nav-btn');
    for(var j=0;j<navBtns.length;j++){navBtns[j].classList.remove('active');if(navBtns[j].getAttribute('data-target')===targetId)navBtns[j].classList.add('active')}
    var sections=document.querySelectorAll('.section');
    for(var k=0;k<sections.length;k++)sections[k].classList.remove('active');
    if($(targetId))$(targetId).classList.add('active');
    if(targetId==='dashboard')updateDashboard();
    if(targetId==='ledger')initLedger();
    if(targetId==='templates')renderTemplates();
}

function updateDashboard(){
    var totalSales=0,totalPending=0;
    for(var i=0;i<DB.invoices.length;i++){totalSales+=DB.invoices[i].grandTotal;totalPending+=DB.invoices[i].balance}
    $('statSales').textContent=fmt(totalSales);$('statInv').textContent=DB.invoices.length;$('statParties').textContent=DB.parties.length;$('statPending').textContent=fmt(totalPending);
    var tb=$('dashRecentInv');
    if(DB.invoices.length===0){tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:1rem;">No data</td></tr>'}
    else{
        var html='';var start=Math.max(0,DB.invoices.length-5);
        for(var i=DB.invoices.length-1;i>=start;i--){
            var inv=DB.invoices[i];var p=getPartyById(inv.partyId);
            var sc=inv.balance<=0?'var(--primary-light)':'var(--warning-light)';
            var tc=inv.balance<=0?'var(--primary-dark)':'#92400e';
            html+='<tr><td>'+inv.number+'</td><td>'+(p?p.name:'-')+'</td><td>'+inv.date+'</td><td>'+fmt(inv.grandTotal)+'</td><td><span style="background:'+sc+';color:'+tc+';padding:0.25rem 0.6rem;border-radius:20px;font-size:0.75rem;font-weight:600;">'+(inv.balance<=0?'Paid':'Pending')+'</span></td></tr>'
        }
        tb.innerHTML=html
    }
}

function renderAllTables(){
    var ptb=$('partyTableBody');
    ptb.innerHTML=DB.parties.length?DB.parties.map(function(p){return '<tr><td>'+p.name+'</td><td>'+p.phone+'</td><td>'+(p.email||'-')+'</td><td>'+fmt(getPartyBalance(p.id))+'</td><td style="position:relative;"><button class="btn btn-info btn-sm explore-btn" data-type="party" data-id="'+p.id+'">🔍 Explore</button></td></tr>'}).join(''):'<tr><td colspan="5" style="text-align:center;padding:1rem;">No parties</td></tr>';
    
    var itb=$('itemTableBody');
    itb.innerHTML=DB.items.length?DB.items.map(function(item){return '<tr><td>'+item.name+'</td><td>'+fmt(item.price)+'</td><td>'+item.stock+'</td><td>'+item.gst+'%</td><td><button class="btn btn-outline btn-sm btn-edit-item" data-id="'+item.id+'">✏️ Edit</button> <button class="btn btn-danger btn-sm btn-del-item" data-id="'+item.id+'">Del</button></td></tr>'}).join(''):'<tr><td colspan="5" style="text-align:center;padding:1rem;">No items</td></tr>';
    
    var invtb=$('invTableBody');
    invtb.innerHTML=DB.invoices.length?DB.invoices.map(function(inv){var p=getPartyById(inv.partyId);return '<tr><td>'+inv.number+'</td><td>'+(p?p.name:'-')+'</td><td>'+inv.date+'</td><td>'+fmt(inv.grandTotal)+'</td><td>'+fmt(inv.balance)+'</td><td style="position:relative;"><button class="btn btn-info btn-sm explore-btn" data-type="invoice" data-id="'+inv.id+'">🔍 Explore</button></td></tr>'}).join(''):'<tr><td colspan="6" style="text-align:center;padding:1rem;">No invoices</td></tr>';
    
    var qtb=$('quoTableBody');
    qtb.innerHTML=DB.quotations.length?DB.quotations.map(function(q){var p=getPartyById(q.partyId);var statusBadge=q.status==='Converted'?'<span style="background:var(--primary-light);color:var(--primary-dark);padding:0.25rem 0.6rem;border-radius:20px;font-size:0.75rem;font-weight:600;">Converted</span>':'<span style="background:var(--warning-light);color:#92400e;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.75rem;font-weight:600;">Pending</span>';return '<tr><td>'+q.number+'</td><td>'+(p?p.name:'-')+'</td><td>'+q.date+'</td><td>'+fmt(q.grandTotal)+'</td><td>'+statusBadge+'</td><td style="position:relative;"><button class="btn btn-info btn-sm explore-btn" data-type="quotation" data-id="'+q.id+'">🔍 Explore</button></td></tr>'}).join(''):'<tr><td colspan="6" style="text-align:center;padding:1rem;">No quotations</td></tr>';
}

function renderTemplates(){
    var tb=$('tempTableBody');
    if(DB.templates.length===0){tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:1rem;">No templates</td></tr>';return}
    tb.innerHTML=DB.templates.map(function(t){var validItems=t.items.filter(function(item){return getItemById(item.itemId)});return '<tr><td><strong>'+t.name+'</strong></td><td>'+validItems.length+' items</td><td>'+fmt(t.total)+'</td><td>'+t.date+'</td><td><button class="btn btn-primary btn-sm btn-use-temp" data-id="'+t.id+'">Use</button> <button class="btn btn-danger btn-sm btn-del-temp" data-id="'+t.id+'">Del</button></td></tr>'}).join('')
}

// --- EXPLORE MENU ---
document.addEventListener('click',function(e){
    if(e.target.classList.contains('explore-btn')){
        e.stopPropagation();
        var type=e.target.getAttribute('data-type');
        var id=e.target.getAttribute('data-id');
        showExploreMenu(type,id);
    }
});

function showExploreMenu(type,id){
    exploreContext={type:type,id:id};
    var optionsHtml='';
    if(type==='party'){
        var p=getPartyById(id);if(!p)return;
        $('exploreTitle').textContent='Explore: '+p.name;
        optionsHtml='<div class="explore-menu-item" data-action="edit-party" data-id="'+id+'">✏️ Edit Party</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="call" data-phone="'+p.phone+'">📞 Call '+p.phone+'</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="whatsapp" data-phone="'+p.phone+'" data-name="'+p.name+'">💬 WhatsApp</div>';
        var pendingQuo=hasPendingQuotation(id);
        if(pendingQuo){
            optionsHtml+='<div class="explore-menu-item" data-action="convert-quotation" data-id="'+pendingQuo.id+'">🧾 Convert Quotation to Invoice ('+pendingQuo.number+')</div>';
            optionsHtml+='<div class="explore-menu-item" data-action="send-quotation" data-id="'+id+'">📄 Send Quotation</div>'
        }else{
            optionsHtml+='<div class="explore-menu-item" data-action="send-quotation" data-id="'+id+'">📄 Create New Quotation</div>';
            optionsHtml+='<div class="explore-menu-item" data-action="send-invoice" data-id="'+id+'">🧾 Create New Invoice</div>'
        }
        optionsHtml+='<div class="explore-menu-item" data-action="update-payment" data-id="'+id+'">💰 Update Payment</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="send-reminder" data-id="'+id+'">🔔 Send Payment Reminder</div>';
        optionsHtml+='<div class="explore-menu-item danger" data-action="delete-party" data-id="'+id+'">🗑️ Delete Party</div>';
    }else if(type==='invoice'){
        var inv=null;for(var i=0;i<DB.invoices.length;i++){if(DB.invoices[i].id===id)inv=DB.invoices[i]}
        if(!inv)return;
        var p=getPartyById(inv.partyId);
        $('exploreTitle').textContent='Explore: '+inv.number;
        optionsHtml='<div class="explore-menu-item" data-action="create-new-invoice">➕ Create New Invoice</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="call" data-phone="'+(p?p.phone:'')+'">📞 Call Party</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="update-payment" data-id="'+id+'">💰 Update Payment</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="send-reminder" data-id="'+id+'">🔔 Send Payment Reminder</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="preview-doc" data-type="invoice" data-id="'+id+'">👁️ Preview</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="print-doc" data-type="invoice" data-id="'+id+'">🖨️ Print / PDF</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="whatsapp-invoice" data-phone="'+(p?p.phone:'')+'" data-name="'+(p?p.name:'')+'" data-amount="'+fmt(inv.grandTotal)+'" data-number="'+inv.number+'">💬 Send on WhatsApp</div>';
        optionsHtml+='<div class="explore-menu-item danger" data-action="delete-invoice" data-id="'+id+'">🗑️ Delete Invoice</div>';
    }else if(type==='quotation'){
        var q=null;for(var i=0;i<DB.quotations.length;i++){if(DB.quotations[i].id===id)q=DB.quotations[i]}
        if(!q)return;
        var p=getPartyById(q.partyId);
        $('exploreTitle').textContent='Explore: '+q.number;
        if(q.status!=='Converted'){
            optionsHtml='<div class="explore-menu-item" data-action="convert-to-invoice" data-id="'+id+'">🧾 Convert to Invoice</div>'
        }else{
            optionsHtml='<div class="explore-menu-item" data-action="create-new-quotation">📄 Create New Quotation</div>'
        }
        optionsHtml+='<div class="explore-menu-item" data-action="call" data-phone="'+(p?p.phone:'')+'">📞 Call Party</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="preview-doc" data-type="quotation" data-id="'+id+'">👁️ Preview</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="print-doc" data-type="quotation" data-id="'+id+'">🖨️ Print / PDF</div>';
        optionsHtml+='<div class="explore-menu-item" data-action="whatsapp-quotation" data-phone="'+(p?p.phone:'')+'" data-name="'+(p?p.name:'')+'" data-amount="'+fmt(q.grandTotal)+'" data-number="'+q.number+'">💬 Send on WhatsApp</div>';
        optionsHtml+='<div class="explore-menu-item danger" data-action="delete-quotation" data-id="'+id+'">🗑️ Delete Quotation</div>';
    }
    $('exploreOptions').innerHTML=optionsHtml;
    openModal('exploreModal');
}

document.addEventListener('click',function(e){
    var action=e.target.getAttribute('data-action');
    if(!action)return;
    if(action==='edit-party'){
        var p=getPartyById(e.target.getAttribute('data-id'));
        if(p){editingId=p.id;$('partyModalTitle').textContent='Edit Party';$('pName').value=p.name;$('pPhone').value=p.phone;$('pEmail').value=p.email||'';$('pAddr').value=p.addr||'';$('btnSavePartyContinue').style.display='none';$('btnSaveParty').style.display='flex';openModal('partyModal')}
        closeModal('exploreModal');
    }else if(action==='call'){
        var phone=e.target.getAttribute('data-phone');
        if(phone)window.location.href='tel:'+phone;
        closeModal('exploreModal');
    }else if(action==='whatsapp'){
        var phone=e.target.getAttribute('data-phone');
        var name=e.target.getAttribute('data-name');
        var companyName=DB.settings.compName||'our company';
        var message='Hi '+name+', welcome to '+companyName+'! How can we help you today?';
        window.open('https://wa.me/91'+phone.replace(/\D/g,'')+'?text='+encodeURIComponent(message),'_blank');
        closeModal('exploreModal');
    }else if(action==='send-quotation'){
        var partyId=e.target.getAttribute('data-id');
        startDocForm('quotation');
        $('docParty').value=partyId;
        closeModal('exploreModal');
    }else if(action==='send-invoice'){
        var partyId=e.target.getAttribute('data-id');
        startDocForm('invoice');
        $('docParty').value=partyId;
        closeModal('exploreModal');
    }else if(action==='convert-quotation'){
        var qId=e.target.getAttribute('data-id');
        var q=null;for(var i=0;i<DB.quotations.length;i++){if(DB.quotations[i].id===qId)q=DB.quotations[i]}
        if(q){
            var newInv={id:Date.now().toString(),number:'INV-'+Date.now().toString().slice(-6),date:today(),type:'invoice',partyId:q.partyId,items:JSON.parse(JSON.stringify(q.items)),advances:[],discount:q.discount||0,subtotal:q.subtotal||0,gstTotal:q.gstTotal||0,grandTotal:q.grandTotal,totalAdvance:0,balance:q.grandTotal,notes:q.notes||''};
            DB.invoices.push(newInv);
            q.status='Converted';
            safeSet('bp_invoices',DB.invoices);safeSet('bp_quotations',DB.quotations);
            toast('Quotation converted to Invoice!');
            refreshUI();
            navigateTo('sales');
        }
        closeModal('exploreModal');
    }else if(action==='update-payment'){
        var id=e.target.getAttribute('data-id');
        var inv=null;
        for(var i=0;i<DB.invoices.length;i++){if(DB.invoices[i].id===id){inv=DB.invoices[i];break}}
        if(!inv){
            var partyId=id;
            var pendingInvoices=DB.invoices.filter(function(inv){return inv.partyId===partyId&&inv.balance>0});
            if(pendingInvoices.length===0){toast('No pending invoices for this party','error');closeModal('exploreModal');return}
            inv=pendingInvoices[pendingInvoices.length-1];
        }
        editingInvoiceId=inv.id;
        currentDocType='invoice';
        currentDocItems=JSON.parse(JSON.stringify(inv.items));
        currentDocAdvances=JSON.parse(JSON.stringify(inv.advances||[]));
        currentDiscount=inv.discount||0;
        $('docFormTitle').textContent='Update Payment: '+inv.number;
        $('docDate').value=inv.date;
        $('docRef').value=inv.number;
        $('docNotes').value=inv.notes||'';
        $('advSection').style.display='block';
        $('discountRow').style.display='none';
        var pSel=$('docParty');
        pSel.innerHTML='<option value="">-- Select Party --</option>'+DB.parties.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>'}).join('');
        pSel.value=inv.partyId;
        pSel.disabled=true;
        renderDocItems();
        renderAdvList();
        closeModal('exploreModal');
        navigateTo('docForm');
        toast('Invoice opened in edit mode. Update advances and save.');
    }else if(action==='send-reminder'){
        var id=e.target.getAttribute('data-id');
        var inv=null;
        for(var i=0;i<DB.invoices.length;i++){if(DB.invoices[i].id===id){inv=DB.invoices[i];break}}
        if(!inv){
            var partyId=id;
            var p=getPartyById(partyId);
            if(!p)return;
            var balance=getPartyBalance(partyId);
            if(balance<=0){toast('No pending payment','error');closeModal('exploreModal');return}
            var companyName=DB.settings.compName||'our company';
            var message='Hi '+p.name+', this is a gentle reminder from '+companyName+'. Your pending balance is '+fmt(balance)+'. Please clear it at your earliest convenience. Thank you!';
            window.open('https://wa.me/91'+p.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(message),'_blank');
            closeModal('exploreModal');
            toast('Payment reminder sent!');
            return;
        }
        var p=getPartyById(inv.partyId);
        if(!p){toast('Party not found','error');closeModal('exploreModal');return}
        if(inv.balance<=0){toast('Invoice already paid','error');closeModal('exploreModal');return}
        var companyName=DB.settings.compName||'our company';
        var message='Hi '+p.name+', this is a gentle reminder from '+companyName+' regarding Invoice #'+inv.number+' dated '+inv.date+'. Your remaining balance is '+fmt(inv.balance)+' out of '+fmt(inv.grandTotal)+'. Please clear the payment at your earliest convenience. Thank you!';
        window.open('https://wa.me/91'+p.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(message),'_blank');
        closeModal('exploreModal');
        toast('Payment reminder sent!');
    }else if(action==='delete-party'){
        var id=e.target.getAttribute('data-id');
        if(confirm('Delete this party?')){
            DB.parties=DB.parties.filter(function(p){return p.id!==id});
            safeSet('bp_parties',DB.parties);
            refreshUI();
            toast('Party deleted');
        }
        closeModal('exploreModal');
    }else if(action==='create-new-invoice'){
        startDocForm('invoice');
        closeModal('exploreModal');
    }else if(action==='create-new-quotation'){
        startDocForm('quotation');
        closeModal('exploreModal');
    }else if(action==='convert-to-invoice'){
        var qId=e.target.getAttribute('data-id');
        var qIndex=-1;
        for(var i=0;i<DB.quotations.length;i++){if(DB.quotations[i].id===qId){qIndex=i;break}}
        if(qIndex!==-1){
            var q=DB.quotations[qIndex];
            var newInv={id:Date.now().toString(),number:'INV-'+Date.now().toString().slice(-6),date:today(),type:'invoice',partyId:q.partyId,items:JSON.parse(JSON.stringify(q.items)),advances:[],discount:q.discount||0,subtotal:q.subtotal||0,gstTotal:q.gstTotal||0,grandTotal:q.grandTotal,totalAdvance:0,balance:q.grandTotal,notes:q.notes||''};
            DB.invoices.push(newInv);
            q.status='Converted';
            safeSet('bp_invoices',DB.invoices);safeSet('bp_quotations',DB.quotations);
            toast('Converted to Invoice!');
            refreshUI();
            navigateTo('sales');
        }
        closeModal('exploreModal');
    }else if(action==='preview-doc'){
        var type=e.target.getAttribute('data-type');var id=e.target.getAttribute('data-id');var doc=null;
        if(type==='invoice'){for(var i=0;i<DB.invoices.length;i++){if(DB.invoices[i].id===id)doc=DB.invoices[i]}}
        else{for(var i=0;i<DB.quotations.length;i++){if(DB.quotations[i].id===id)doc=DB.quotations[i]}}
        if(doc)showPreview(doc,type);
        closeModal('exploreModal');
    }else if(action==='print-doc'){
        var type=e.target.getAttribute('data-type');var id=e.target.getAttribute('data-id');var doc=null;
        if(type==='invoice'){for(var i=0;i<DB.invoices.length;i++){if(DB.invoices[i].id===id)doc=DB.invoices[i]}}
        else{for(var i=0;i<DB.quotations.length;i++){if(DB.quotations[i].id===id)doc=DB.quotations[i]}}
        if(doc)printDocument(doc,type);
        closeModal('exploreModal');
    }else if(action==='whatsapp-invoice'||action==='whatsapp-quotation'){
        var phone=e.target.getAttribute('data-phone');
        var name=e.target.getAttribute('data-name');
        var amount=e.target.getAttribute('data-amount');
        var number=e.target.getAttribute('data-number');
        var companyName=DB.settings.compName||'our company';
        var docType=action==='whatsapp-invoice'?'Invoice':'Quotation';
        var message='Hi '+name+', please find your '+docType+' #'+number+' from '+companyName+' for amount '+amount+'. Thank you!';
        window.open('https://wa.me/91'+phone.replace(/\D/g,'')+'?text='+encodeURIComponent(message),'_blank');
        closeModal('exploreModal');
    }else if(action==='delete-invoice'){
        var id=e.target.getAttribute('data-id');
        if(confirm('Delete this invoice?')){
            DB.invoices=DB.invoices.filter(function(i){return i.id!==id});
            safeSet('bp_invoices',DB.invoices);
            refreshUI();
            toast('Invoice deleted');
        }
        closeModal('exploreModal');
    }else if(action==='delete-quotation'){
        var id=e.target.getAttribute('data-id');
        if(confirm('Delete this quotation?')){
            DB.quotations=DB.quotations.filter(function(q){return q.id!==id});
            safeSet('bp_quotations',DB.quotations);
            refreshUI();
            toast('Quotation deleted');
        }
        closeModal('exploreModal');
    }
});

function showPreview(doc,type){
    var p=getPartyById(doc.partyId);
    var itemsHtml=doc.items.map(function(i){return '<tr><td style="border:1px solid #ddd;padding:8px;">'+i.name+'</td><td style="border:1px solid #ddd;padding:8px;">'+i.qty+'</td><td style="border:1px solid #ddd;padding:8px;">'+fmt(i.price)+'</td><td style="border:1px solid #ddd;padding:8px;">'+i.gst+'%</td><td style="border:1px solid #ddd;padding:8px;">'+fmt(i.total)+'</td></tr>'}).join('');
    var advancesHtml='';
    if(type==='invoice'&&doc.advances&&doc.advances.length>0){
        advancesHtml='<h4 style="margin-top:1rem;">Advance Payments</h4><table style="width:100%;"><thead><tr><th style="border:1px solid #ddd;padding:8px;">Date</th><th style="border:1px solid #ddd;padding:8px;">Mode</th><th style="border:1px solid #ddd;padding:8px;">UTR</th><th style="border:1px solid #ddd;padding:8px;">Amount</th></tr></thead><tbody>';
        doc.advances.forEach(function(a){advancesHtml+='<tr><td style="border:1px solid #ddd;padding:8px;">'+a.date+'</td><td style="border:1px solid #ddd;padding:8px;">'+a.mode+'</td><td style="border:1px solid #ddd;padding:8px;">'+(a.utr||'-')+'</td><td style="border:1px solid #ddd;padding:8px;">'+fmt(a.amt)+'</td></tr>'});
        advancesHtml+='</tbody></table>';
    }
    var discountHtml=doc.discount>0?'<p>Discount: '+fmt(doc.discount)+'</p>':'';
    var previewContent='<div style="padding:1rem;font-family:sans-serif;"><h1 style="color:var(--primary);">'+(DB.settings.compName||'My Company')+'</h1><p>'+(DB.settings.compMobile||'')+' | '+(DB.settings.compEmail||'')+'</p><hr style="margin:1rem 0;"><h2>'+(type==='invoice'?'TAX INVOICE':'QUOTATION')+'</h2><p><strong>#:</strong> '+doc.number+' | <strong>Date:</strong> '+doc.date+'</p><p><strong>Party:</strong> '+(p?p.name:'Unknown')+' ('+(p?p.phone:'')+')</p><table style="width:100%;border-collapse:collapse;margin-top:1rem;"><thead><tr style="background:#f0f0f0;"><th style="border:1px solid #ddd;padding:8px;">Item</th><th style="border:1px solid #ddd;padding:8px;">Qty</th><th style="border:1px solid #ddd;padding:8px;">Price</th><th style="border:1px solid #ddd;padding:8px;">GST</th><th style="border:1px solid #ddd;padding:8px;">Total</th></tr></thead><tbody>'+itemsHtml+'</tbody></table><div style="margin-top:1rem;text-align:right;"><p>Subtotal: '+fmt(doc.subtotal)+'</p><p>GST: '+fmt(doc.gstTotal)+'</p>'+discountHtml+'<h3>Grand Total: '+fmt(doc.grandTotal)+'</h3><p class="amount-words">'+numToWords(doc.grandTotal)+'</p></div>'+advancesHtml+(type==='invoice'?'<h3 style="color:#ef4444;margin-top:1rem;">Balance Due: '+fmt(doc.balance)+'</h3>':'')+'<p style="margin-top:2rem;"><strong>Notes:</strong> '+(doc.notes||'None')+'</p></div>';
    $('previewContent').innerHTML=previewContent;
    $('btnPrintFromPreview').onclick=function(){printDocument(doc,type)};
    openModal('previewModal');
}

function startDocForm(type){
    editingInvoiceId=null;
    currentDocType=type;currentDocItems=[];currentDocAdvances=[];currentDiscount=0;
    $('docFormTitle').textContent=type==='invoice'?'New Sales Invoice':type==='quotation'?'New Quotation':'New Purchase Order';
    $('docDate').value=today();$('docRef').value=(type==='invoice'?'INV-':type==='quotation'?'QUO-':'PO-')+Date.now().toString().slice(-6);
    $('docNotes').value=DB.settings.notes||'';
    $('advSection').style.display=type==='invoice'?'block':'none';
    $('discountRow').style.display=type==='quotation'?'flex':'none';
    var pSel=$('docParty');
    pSel.innerHTML='<option value="">-- Select Party --</option>'+DB.parties.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>'}).join('');
    pSel.disabled=false;
    renderDocItems();
    renderAdvList();
    navigateTo('docForm');
}

$('btnNewInv').onclick=function(){startDocForm('invoice')};
$('btnNewQuo').onclick=function(){startDocForm('quotation')};
$('btnNewPur').onclick=function(){startDocForm('purchase')};
$('btnCancelDoc').onclick=function(){editingInvoiceId=null;$('docParty').disabled=false;$('discountRow').style.display='flex';navigateTo('dashboard')};

$('btnAddPartyInline').onclick=function(){
    continueToDoc=1;editingId=null;
    $('partyModalTitle').textContent='Add Party';
    $('pName').value='';$('pPhone').value='';$('pEmail').value='';$('pAddr').value='';
    $('btnSaveParty').style.display='none';
    $('btnSavePartyContinue').style.display='flex';
    openModal('partyModal');
};

$('btnLedgerAddParty').onclick=function(){
    continueToDoc=3;editingId=null;
    $('partyModalTitle').textContent='Add New Party';
    $('pName').value='';$('pPhone').value='';$('pEmail').value='';$('pAddr').value='';
    $('btnSaveParty').style.display='none';
    $('btnSavePartyContinue').style.display='flex';
    openModal('partyModal');
};

$('btnFromQuo').onclick=function(){
    var tb=$('pickQuoBody');
    if(DB.quotations.length===0){tb.innerHTML='<tr><td colspan="4" style="text-align:center;padding:1rem;">No quotations</td></tr>'}
    else{
        tb.innerHTML=DB.quotations.map(function(q){var p=getPartyById(q.partyId);return '<tr><td>'+q.number+'</td><td>'+(p?p.name:'-')+'</td><td>'+fmt(q.grandTotal)+'</td><td><button class="btn btn-primary btn-sm btn-use-quo" data-id="'+q.id+'">Use</button></td></tr>'}).join('');
    }
    openModal('pickQuoModal');
};

$('btnAddItemToDoc').onclick=function(){
    var sel=$('diSelect');
    sel.innerHTML='<option value="">-- Select an Item --</option>';
    for(var i=0;i<DB.items.length;i++){sel.innerHTML+='<option value="'+DB.items[i].id+'" data-price="'+DB.items[i].price+'" data-gst="'+DB.items[i].gst+'">'+DB.items[i].name+'</option>'}
    $('diQty').value=1;$('diPrice').value='';$('diGst').value=18;
    openModal('docItemModal');
};
$('diSelect').onchange=function(){var opt=this.options[this.selectedIndex];if(opt.value){$('diPrice').value=opt.getAttribute('data-price');$('diGst').value=opt.getAttribute('data-gst')}};
$('btnAddDi').onclick=function(){
    var itemId=$('diSelect').value;if(!itemId){toast('Select an item first','error');return}
    var foundItem=getItemById(itemId);
    var qty=parseFloat($('diQty').value),price=parseFloat($('diPrice').value),gst=parseFloat($('diGst').value);
    if(!qty||!price){toast('Fill qty and price','error');return}
    var sub=qty*price,gstAmt=(sub*gst)/100;
    currentDocItems.push({itemId:itemId,name:foundItem.name,qty:qty,price:price,gst:gst,sub:sub,gstAmt:gstAmt,total:sub+gstAmt});
    renderDocItems();closeModal('docItemModal');
};

$('btnAddToInventory').onclick=function(){
    continueToDoc=2;editingItemId=null;
    $('itemModalTitle').textContent='Add Item';
    $('iName').value='';$('iPrice').value=$('diPrice').value||'';$('iStock').value='';$('iGst').value=$('diGst').value||18;$('iDesc').value='';$('iMoreInfo').value='';
    $('btnSaveItem').style.display='none';
    $('btnSaveAsTemplate').style.display='none';
    $('btnSaveAndContinue').style.display='flex';
    closeModal('docItemModal');
    openModal('itemModal');
};

$('btnPickTemplate').onclick=function(){
    var tb=$('pickTempBody');
    if(DB.templates.length===0){tb.innerHTML='<tr><td colspan="3" style="text-align:center;padding:1rem;">No templates saved yet.</td></tr>'}
    else{
        tb.innerHTML=DB.templates.map(function(t){var validItems=t.items.filter(function(item){return getItemById(item.itemId)});return '<tr><td><strong>'+t.name+'</strong></td><td>'+validItems.length+' items</td><td><button class="btn btn-primary btn-sm btn-use-temp" data-id="'+t.id+'">Use</button></td></tr>'}).join('');
    }
    openModal('pickTempModal');
};

function renderDocItems(){
    var tb=$('docItemsBody');
    if(currentDocItems.length===0){tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:1rem;">No items added</td></tr>';calcDocTotals();return}
    tb.innerHTML=currentDocItems.map(function(it,i){return '<tr><td>'+it.name+'</td><td>'+it.qty+'</td><td>'+fmt(it.price)+'</td><td>'+it.gst+'%</td><td>'+fmt(it.total)+'</td><td><button class="btn btn-danger btn-sm btn-rm-di" data-i="'+i+'">X</button></td></tr>'}).join('');
    calcDocTotals();
}
$('docItemsBody').onclick=function(e){if(e.target.classList.contains('btn-rm-di')){currentDocItems.splice(parseInt(e.target.getAttribute('data-i')),1);renderDocItems()}};

$('btnAddAdvToDoc').onclick=function(){$('aAmt').value='';$('aDate').value=today();$('aUtr').value='';$('aScreen').value='';$('aScreenPreview').style.display='none';currentScreenBase64='';openModal('advModal')};
$('aScreen').onchange=function(e){if(e.target.files&&e.target.files[0]){var reader=new FileReader();reader.onload=function(ev){currentScreenBase64=ev.target.result;$('aScreenPreview').src=currentScreenBase64;$('aScreenPreview').style.display='block'};reader.readAsDataURL(e.target.files[0])}};
$('btnSaveAdv').onclick=function(){var amt=parseFloat($('aAmt').value);if(!amt){toast('Enter amount','error');return}currentDocAdvances.push({amt:amt,date:$('aDate').value,mode:$('aMode').value,utr:$('aUtr').value,screenshot:currentScreenBase64||''});calcDocTotals();renderAdvList();closeModal('advModal');toast('Advance added')};

function renderAdvList(){
    var container=$('advListContainer');
    if(currentDocAdvances.length===0){container.innerHTML='';return}
    var html='<div style="margin-top:0.5rem;"><strong style="font-size:0.85rem;color:var(--muted);">Advance History:</strong></div>';
    currentDocAdvances.forEach(function(a,i){
        html+='<div class="advance-item"><div class="advance-details"><div class="mode">'+a.mode+(a.utr?' | UTR: '+a.utr:'')+'</div><div class="meta">📅 '+a.date+(a.screenshot?' | 📷 Attached':'')+'</div>';
        if(a.screenshot){html+='<img src="'+a.screenshot+'" alt="Screenshot">'}
        html+='</div><div style="display:flex;align-items:center;gap:0.5rem;"><span class="advance-amount">'+fmt(a.amt)+'</span><button class="btn btn-danger btn-sm" onclick="removeAdvance('+i+')">✕</button></div></div>';
    });
    container.innerHTML=html;
}
window.removeAdvance=function(i){currentDocAdvances.splice(i,1);calcDocTotals();renderAdvList();toast('Advance removed')};

function calcDocTotals(){
    var sub=0,gst=0;
    for(var i=0;i<currentDocItems.length;i++){sub+=currentDocItems[i].sub;gst+=currentDocItems[i].gstAmt}
    var grandBeforeDiscount=sub+gst;
    var grand=grandBeforeDiscount-currentDiscount;
    var adv=0;
    for(var i=0;i<currentDocAdvances.length;i++){adv+=currentDocAdvances[i].amt}
    $('calcSub').textContent=fmt(sub);
    $('calcGst').textContent=fmt(gst);
    $('calcDiscount').textContent=fmt(currentDiscount);
    $('calcGrand').textContent=fmt(grand);
    $('amountWords').textContent=numToWords(grand);
    $('calcAdv').textContent=fmt(adv);
    $('calcBal').textContent=fmt(grand-adv);
}

$('btnSaveDoc').onclick=function(){
    var partyId=$('docParty').value;if(!partyId||currentDocItems.length===0){toast('Select party & add items','error');return}
    var sub=0,gst=0;for(var i=0;i<currentDocItems.length;i++){sub+=currentDocItems[i].sub;gst+=currentDocItems[i].gstAmt}
    var grand=sub+gst-currentDiscount;
    var adv=0;for(var i=0;i<currentDocAdvances.length;i++){adv+=currentDocAdvances[i].amt}
    
    if(editingInvoiceId){
        for(var i=0;i<DB.invoices.length;i++){
            if(DB.invoices[i].id===editingInvoiceId){
                DB.invoices[i].items=currentDocItems;
                DB.invoices[i].advances=currentDocAdvances;
                DB.invoices[i].discount=currentDiscount;
                DB.invoices[i].subtotal=sub;
                DB.invoices[i].gstTotal=gst;
                DB.invoices[i].grandTotal=grand;
                DB.invoices[i].totalAdvance=adv;
                DB.invoices[i].balance=grand-adv;
                DB.invoices[i].notes=$('docNotes').value;
                break;
            }
        }
        safeSet('bp_invoices',DB.invoices);
        editingInvoiceId=null;
        $('docParty').disabled=false;
        $('discountRow').style.display='flex';
        toast('Invoice updated successfully!');
        refreshUI();
        navigateTo('sales');
    }else{
        var doc={id:Date.now().toString(),number:$('docRef').value,partyId:partyId,date:$('docDate').value,items:currentDocItems,advances:currentDocAdvances,discount:currentDiscount,subtotal:sub,gstTotal:gst,grandTotal:grand,totalAdvance:adv,balance:grand-adv,notes:$('docNotes').value,type:currentDocType};
        if(currentDocType==='invoice'){DB.invoices.push(doc);safeSet('bp_invoices',DB.invoices)}
        else if(currentDocType==='quotation'){DB.quotations.push(doc);safeSet('bp_quotations',DB.quotations)}
        else{DB.purchases.push(doc);safeSet('bp_purchases',DB.purchases)}
        toast('Document Saved!');
        refreshUI();
        var target=currentDocType==='invoice'?'sales':currentDocType==='quotation'?'quotations':'purchase';
        navigateTo(target);
    }
};

$('btnSendWhatsApp').onclick=function(){
    var partyId=$('docParty').value;
    if(!partyId){toast('Please select a party first','error');return}
    if(currentDocItems.length===0){toast('Add items first','error');return}
    var p=getPartyById(partyId);
    if(!p||!p.phone){toast('Party phone number not found','error');return}
    var sub=0,gst=0;for(var i=0;i<currentDocItems.length;i++){sub+=currentDocItems[i].sub;gst+=currentDocItems[i].gstAmt}
    var grand=sub+gst-currentDiscount;
    var adv=0;for(var i=0;i<currentDocAdvances.length;i++){adv+=currentDocAdvances[i].amt}
    var balance=grand-adv;
    var companyName=DB.settings.compName||'Our Company';
    var docType=currentDocType==='invoice'?'Invoice':'Quotation';
    var refNum=$('docRef').value;
    var message='📄 *'+docType+' from '+companyName+'*\n\n📋 Ref: '+refNum+'\n📅 Date: '+$('docDate').value+'\n\n*Items:*\n';
    currentDocItems.forEach(function(it,i){message+=(i+1)+'. '+it.name+' - Qty: '+it.qty+' × '+fmt(it.price)+' = '+fmt(it.total)+'\n'});
    message+='\nSubtotal: '+fmt(sub)+'\nGST: '+fmt(gst)+'\n';
    if(currentDiscount>0)message+='Discount: -'+fmt(currentDiscount)+'\n';
    message+='*Grand Total: '+fmt(grand)+'*\n';
    if(currentDocType==='invoice'&&adv>0){message+='Advance Paid: '+fmt(adv)+'\n*Balance Due: '+fmt(balance)+'*\n'}
    if($('docNotes').value)message+='\n📝 Notes: '+$('docNotes').value+'\n';
    message+='\nThank you! - '+companyName;
    window.open('https://wa.me/91'+p.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(message),'_blank');
    toast('WhatsApp opened!');
};

$('btnPreviewDoc').onclick=function(){if(currentDocItems.length===0){toast('Add items first','error');return}var partyId=$('docParty').value;var sub=0,gst=0;for(var i=0;i<currentDocItems.length;i++){sub+=currentDocItems[i].sub;gst+=currentDocItems[i].gstAmt}var grand=sub+gst-currentDiscount;var adv=0;for(var i=0;i<currentDocAdvances.length;i++){adv+=currentDocAdvances[i].amt}var doc={number:$('docRef').value,partyId:partyId,date:$('docDate').value,items:currentDocItems,advances:currentDocAdvances,discount:currentDiscount,subtotal:sub,gstTotal:gst,grandTotal:grand,totalAdvance:adv,balance:grand-adv,notes:$('docNotes').value};showPreview(doc,currentDocType)};
$('btnPrintDoc').onclick=function(){if(currentDocItems.length===0){toast('Add items first','error');return}var partyId=$('docParty').value;var sub=0,gst=0;for(var i=0;i<currentDocItems.length;i++){sub+=currentDocItems[i].sub;gst+=currentDocItems[i].gstAmt}var grand=sub+gst-currentDiscount;var adv=0;for(var i=0;i<currentDocAdvances.length;i++){adv+=currentDocAdvances[i].amt}var doc={number:$('docRef').value,partyId:partyId,date:$('docDate').value,items:currentDocItems,advances:currentDocAdvances,discount:currentDiscount,subtotal:sub,gstTotal:gst,grandTotal:grand,totalAdvance:adv,balance:grand-adv,notes:$('docNotes').value};printDocument(doc,currentDocType)};

$('btnNewParty').onclick=function(){continueToDoc=0;editingId=null;$('partyModalTitle').textContent='Add Party';$('pName').value='';$('pPhone').value='';$('pEmail').value='';$('pAddr').value='';$('btnSaveParty').style.display='flex';$('btnSavePartyContinue').style.display='none';openModal('partyModal')};
$('btnSaveParty').onclick=function(){var name=$('pName').value,phone=$('pPhone').value;if(!name||!phone){toast('Name/Phone required','error');return}if(editingId){for(var i=0;i<DB.parties.length;i++){if(DB.parties[i].id===editingId){DB.parties[i].name=name;DB.parties[i].phone=phone;DB.parties[i].email=$('pEmail').value;DB.parties[i].addr=$('pAddr').value}}}else{DB.parties.push({id:Date.now().toString(),name:name,phone:phone,email:$('pEmail').value,addr:$('pAddr').value})}safeSet('bp_parties',DB.parties);closeModal('partyModal');refreshUI();toast('Party Saved!')};
$('btnSavePartyContinue').onclick=function(){var name=$('pName').value,phone=$('pPhone').value;if(!name||!phone){toast('Name/Phone required','error');return}DB.parties.push({id:Date.now().toString(),name:name,phone:phone,email:$('pEmail').value,addr:$('pAddr').value});safeSet('bp_parties',DB.parties);closeModal('partyModal');if(continueToDoc===1){var pSel=$('docParty');pSel.innerHTML='<option value="">-- Select Party --</option>'+DB.parties.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>'}).join('');pSel.value=DB.parties[DB.parties.length-1].id;continueToDoc=0;toast('Party added! Continue with document.')}else if(continueToDoc===3){initLedger();$('ledgerPartySelect').value=DB.parties[DB.parties.length-1].id;$('ledgerContent').style.display='block';renderLedger();continueToDoc=0;toast('Party added! Ledger updated.')}else{refreshUI();toast('Party Saved!')}};

$('btnNewItem').onclick=function(){continueToDoc=0;editingItemId=null;$('itemModalTitle').textContent='Add Item';$('iName').value='';$('iPrice').value='';$('iStock').value='';$('iGst').value=18;$('iDesc').value='';$('iMoreInfo').value='';$('btnSaveItem').style.display='flex';$('btnSaveAsTemplate').style.display='flex';$('btnSaveAndContinue').style.display='none';openModal('itemModal')};
function openItemEditModal(item){continueToDoc=0;editingItemId=item.id;$('itemModalTitle').textContent='Edit Item';$('iName').value=item.name;$('iPrice').value=item.price;$('iStock').value=item.stock;$('iGst').value=item.gst;$('iDesc').value=item.desc||'';$('iMoreInfo').value=item.moreInfo||'';$('btnSaveItem').style.display='flex';$('btnSaveAsTemplate').style.display='none';$('btnSaveAndContinue').style.display='flex';openModal('itemModal')}
$('btnSaveItem').onclick=function(){var name=$('iName').value,price=parseFloat($('iPrice').value);if(!name||!price){toast('Name/Price required','error');return}if(editingItemId){for(var i=0;i<DB.items.length;i++){if(DB.items[i].id===editingItemId){DB.items[i].name=name;DB.items[i].price=price;DB.items[i].stock=$('iStock').value;DB.items[i].gst=$('iGst').value;DB.items[i].desc=$('iDesc').value;DB.items[i].moreInfo=$('iMoreInfo').value}}}else{DB.items.push({id:Date.now().toString(),name:name,price:price,stock:$('iStock').value,gst:$('iGst').value,desc:$('iDesc').value,moreInfo:$('iMoreInfo').value})}safeSet('bp_items',DB.items);closeModal('itemModal');refreshUI();toast('Item Saved!')};
$('btnSaveAndContinue').onclick=function(){var name=$('iName').value,price=parseFloat($('iPrice').value);if(!name||!price){toast('Name/Price required','error');return}if(editingItemId){for(var i=0;i<DB.items.length;i++){if(DB.items[i].id===editingItemId){DB.items[i].name=name;DB.items[i].price=price;DB.items[i].stock=$('iStock').value;DB.items[i].gst=$('iGst').value;DB.items[i].desc=$('iDesc').value;DB.items[i].moreInfo=$('iMoreInfo').value}}}else{DB.items.push({id:Date.now().toString(),name:name,price:price,stock:$('iStock').value,gst:$('iGst').value,desc:$('iDesc').value,moreInfo:$('iMoreInfo').value})}safeSet('bp_items',DB.items);closeModal('itemModal');if(continueToDoc===2){var sel=$('diSelect');sel.innerHTML='<option value="">-- Select an Item --</option>';for(var i=0;i<DB.items.length;i++){sel.innerHTML+='<option value="'+DB.items[i].id+'" data-price="'+DB.items[i].price+'" data-gst="'+DB.items[i].gst+'">'+DB.items[i].name+'</option>'}sel.value=DB.items[DB.items.length-1].id;$('diPrice').value=DB.items[DB.items.length-1].price;$('diGst').value=DB.items[DB.items.length-1].gst;openModal('docItemModal');continueToDoc=0;toast('Item added! Continue with document.')}else{refreshUI();toast('Item Saved!')}};
$('btnSaveAsTemplate').onclick=function(){var name=$('iName').value.trim();if(!name){toast('Enter item name first','error');return}var templateName=prompt('Enter template name:');if(!templateName)return;var tempItem={itemId:editingItemId||'temp_'+Date.now(),name:name,qty:1,price:parseFloat($('iPrice').value)||0,gst:parseFloat($('iGst').value)||18,sub:parseFloat($('iPrice').value)||0,gstAmt:((parseFloat($('iPrice').value)||0)*(parseFloat($('iGst').value)||18))/100,total:(parseFloat($('iPrice').value)||0)*1.18};DB.templates.push({id:Date.now().toString(),name:templateName,items:[tempItem],total:tempItem.total,date:today()});safeSet('bp_templates',DB.templates);refreshUI();toast('Saved as Template!')};
$('btnHowTemplates').onclick=function(){alert('HOW TO USE TEMPLATES:\n\n1. Go to Inventory → Add Item → Fill details → Click "Save as Template"\n2. Give template a name\n3. Now go to Quotations or Sales → Create new → Click "Pick from Templates"\n4. Select your template - all items auto-fill!')};

function initLedger(){var sel=$('ledgerPartySelect');sel.innerHTML='<option value="">-- Select Party --</option>'+DB.parties.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>'}).join('');$('ledgerContent').style.display='none'}
$('ledgerPartySelect').onchange=function(){currentLedgerParty=this.value;if(!currentLedgerParty){$('ledgerContent').style.display='none';return}$('ledgerContent').style.display='block';renderLedger()};
function renderLedger(){if(!currentLedgerParty)return;var totalDebit=0,totalCredit=0,txs=[];for(var i=0;i<DB.invoices.length;i++){if(DB.invoices[i].partyId===currentLedgerParty){totalDebit+=DB.invoices[i].grandTotal;txs.push({date:DB.invoices[i].date,type:'Invoice',ref:DB.invoices[i].number,debit:DB.invoices[i].grandTotal,credit:0})}}for(var i=0;i<DB.payments.length;i++){if(DB.payments[i].partyId===currentLedgerParty){totalCredit+=DB.payments[i].amount;txs.push({date:DB.payments[i].date,type:'Payment',ref:DB.payments[i].mode+(DB.payments[i].utr?'-'+DB.payments[i].utr:''),debit:0,credit:DB.payments[i].amount})}}txs.sort(function(a,b){return new Date(a.date)-new Date(b.date)});$('ledDebit').textContent=fmt(totalDebit);$('ledCredit').textContent=fmt(totalCredit);$('ledBalance').textContent=fmt(totalDebit-totalCredit);var balance=0,tb=$('ledgerTableBody');tb.innerHTML=txs.map(function(t){balance+=(t.debit-t.credit);return '<tr><td>'+t.date+'</td><td>'+t.type+'</td><td>'+t.ref+'</td><td>'+(t.debit?fmt(t.debit):'-')+'</td><td>'+(t.credit?fmt(t.credit):'-')+'</td><td><strong>'+fmt(balance)+'</strong></td></tr>'}).join('')}
$('btnAddPayment').onclick=function(){$('lpAmt').value='';$('lpDate').value=today();openModal('ledPayModal')};
$('btnSaveLedPay').onclick=function(){var amt=parseFloat($('lpAmt').value);if(!amt||!currentLedgerParty){toast('Enter amount','error');return}DB.payments.push({id:Date.now().toString(),partyId:currentLedgerParty,amount:amt,date:$('lpDate').value,mode:$('lpMode').value});safeSet('bp_payments',DB.payments);closeModal('ledPayModal');refreshUI();toast('Payment Recorded!')};

function printDocument(doc,type){
    var p=getPartyById(doc.partyId);
    var itemsHtml=doc.items.map(function(i){return '<tr><td style="border:1px solid #ddd;padding:8px;">'+i.name+'</td><td style="border:1px solid #ddd;padding:8px;">'+i.qty+'</td><td style="border:1px solid #ddd;padding:8px;">'+fmt(i.price)+'</td><td style="border:1px solid #ddd;padding:8px;">'+i.gst+'%</td><td style="border:1px solid #ddd;padding:8px;">'+fmt(i.total)+'</td></tr>'}).join('');
    var advancesSection='';
    if(type==='invoice'&&doc.advances&&doc.advances.length>0){
        advancesSection='<h4 style="margin-top:1.5rem;">Advance Payments History</h4><table style="width:100%;"><thead><tr><th style="border:1px solid #ddd;padding:8px;">Date</th><th style="border:1px solid #ddd;padding:8px;">Mode</th><th style="border:1px solid #ddd;padding:8px;">UTR/Ref</th><th style="border:1px solid #ddd;padding:8px;">Amount</th></tr></thead><tbody>';
        doc.advances.forEach(function(a){advancesSection+='<tr><td style="border:1px solid #ddd;padding:8px;">'+a.date+'</td><td style="border:1px solid #ddd;padding:8px;">'+a.mode+'</td><td style="border:1px solid #ddd;padding:8px;">'+(a.utr||'-')+'</td><td style="border:1px solid #ddd;padding:8px;">'+fmt(a.amt)+'</td></tr>'});
        advancesSection+='</tbody></table>';
    }
    var discountHtml=doc.discount>0?'<p style="text-align:right;">Discount: -'+fmt(doc.discount)+'</p>':'';
    var printContent='<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>'+(type==='invoice'?'Invoice':'Quotation')+' - '+doc.number+'</title><style>body{margin:0;padding:20px;font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse;margin-top:1rem}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f0f0f0}h1{color:#0d9488}.text-right{text-align:right}.balance{color:#ef4444;font-weight:bold}@media print{body{padding:0}}</style></head><body>';
    if(DB.settings.logo){printContent+='<img src="'+DB.settings.logo+'" style="max-width:150px;margin-bottom:10px;">'}
    printContent+='<h1>'+(DB.settings.compName||'My Company')+'</h1>';
    printContent+='<p>'+(DB.settings.compMobile||'')+' | '+(DB.settings.compEmail||'')+(DB.settings.compWeb?' | '+DB.settings.compWeb:'')+'</p>';
    printContent+='<hr style="margin:1rem 0;">';
    printContent+='<h2>'+(type==='invoice'?'TAX INVOICE':'QUOTATION')+'</h2>';
    printContent+='<p><strong>Invoice #:</strong> '+doc.number+' | <strong>Date:</strong> '+doc.date+'</p>';
    printContent+='<p><strong>Party:</strong> '+(p?p.name:'Unknown')+' ('+(p?p.phone:'')+')</p>';
    printContent+='<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead><tbody>'+itemsHtml+'</tbody></table>';
    printContent+='<div class="text-right" style="margin-top:1rem;">';
    printContent+='<p>Subtotal: '+fmt(doc.subtotal)+'</p>';
    printContent+='<p>GST: '+fmt(doc.gstTotal)+'</p>';
    printContent+=discountHtml;
    printContent+='<h3>Grand Total: '+fmt(doc.grandTotal)+'</h3>';
    printContent+='<p class="amount-words">'+numToWords(doc.grandTotal)+'</p>';
    printContent+='</div>';
    printContent+=advancesSection;
    if(type==='invoice'){printContent+='<h3 class="balance" style="margin-top:1rem;">Balance Due: '+fmt(doc.balance)+'</h3>'}
    if(DB.settings.terms){printContent+='<p style="margin-top:2rem;"><strong>Terms:</strong> '+DB.settings.terms+'</p>'}
    if(doc.notes){printContent+='<p><strong>Notes:</strong> '+doc.notes+'</p>'}
    if(DB.settings.signature){printContent+='<p style="margin-top:3rem;text-align:right;"><strong>Authorized Signature:</strong><br>'+DB.settings.signature+'</p>'}
    printContent+='<script>setTimeout(function(){ window.print(); }, 500);<\/script>';
    printContent+='</body></html>';
    
    var iframe=document.createElement('iframe');
    iframe.style.position='fixed';iframe.style.right='0';iframe.style.bottom='0';iframe.style.width='0';iframe.style.height='0';iframe.style.border='0';
    document.body.appendChild(iframe);
    var iframeDoc=iframe.contentWindow.document;
    iframeDoc.open();iframeDoc.write(printContent);iframeDoc.close();
    setTimeout(function(){try{iframe.contentWindow.focus();iframe.contentWindow.print()}catch(e){var w=window.open('','_blank');if(w){w.document.write(printContent);w.document.close()}else{toast('Please allow popups to print','error')}}setTimeout(function(){document.body.removeChild(iframe)},1000)},500);
}

$('btnSaveSettings').onclick=function(){
    var logo = DB.settings.logo;
    if($('setLogoUpload').files && $('setLogoUpload').files[0]) {
        var reader = new FileReader();
        reader.onload = function(ev) { logo = ev.target.result; };
        reader.readAsDataURL($('setLogoUpload').files[0]);
    }
    DB.settings={compName:$('setCompName').value,compMobile:$('setCompMobile').value,compEmail:$('setCompEmail').value,compGst:$('setCompGst').value,compWeb:$('setCompWeb').value,compSocial:$('setCompSocial').value,bankName:$('setBankName').value,bankAcc:$('setBankAcc').value,bankIfsc:$('setBankIfsc').value,bankBranch:$('setBankBranch').value,logo:logo,terms:$('setTerms').value,notes:$('setNotes').value,signature:$('setSignature').value};
    safeSet('bp_settings',DB.settings);
    if(logo) { $('setLogoPreview').src = logo; $('setLogoPreview').style.display = 'block'; }
    toast('Settings Saved!');
};

$('btnBackup').onclick=function(){var dataStr=JSON.stringify(DB,null,2);var blob=new Blob([dataStr],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='billing_backup_'+today()+'.json';a.click();setTimeout(function(){window.location.href='mailto:'+(DB.settings.compEmail||'')+'?subject=Billing Backup&body=Attached is my backup.'},1000);toast('Backup downloaded! Attach to email.','info')};
$('btnRestore').onclick=function(){$('restoreFile').click()};
$('restoreFile').onchange=function(e){if(e.target.files&&e.target.files[0]){var r=new FileReader();r.onload=function(ev){try{var data=JSON.parse(ev.target.result);if(confirm('Replace current data?')){DB={parties:data.parties||[],items:data.items||[],invoices:data.invoices||[],quotations:data.quotations||[],templates:data.templates||[],purchases:data.purchases||[],payments:data.payments||[],settings:data.settings||{compName:'',compMobile:'',compEmail:'',compGst:'',compWeb:'',compSocial:'',bankName:'',bankAcc:'',bankIfsc:'',bankBranch:'',logo:'',terms:'',notes:'',signature:''}};safeSet('bp_parties',DB.parties);safeSet('bp_items',DB.items);safeSet('bp_invoices',DB.invoices);safeSet('bp_quotations',DB.quotations);safeSet('bp_templates',DB.templates);safeSet('bp_purchases',DB.purchases);safeSet('bp_payments',DB.payments);safeSet('bp_settings',DB.settings);initApp();toast('Data Restored!')}}catch(err){toast('Invalid file','error')}}};r.readAsText(e.target.files[0])}};

function initApp(){
    $('setCompName').value=DB.settings.compName||'';
    $('setCompMobile').value=DB.settings.compMobile||'';
    $('setCompEmail').value=DB.settings.compEmail||'';
    $('setCompGst').value=DB.settings.compGst||'';
    $('setCompWeb').value=DB.settings.compWeb||'';
    $('setCompSocial').value=DB.settings.compSocial||'';
    $('setBankName').value=DB.settings.bankName||'';
    $('setBankAcc').value=DB.settings.bankAcc||'';
    $('setBankIfsc').value=DB.settings.bankIfsc||'';
    $('setBankBranch').value=DB.settings.bankBranch||'';
    $('setTerms').value=DB.settings.terms||'';
    $('setNotes').value=DB.settings.notes||'';
    $('setSignature').value=DB.settings.signature||'';
    if(DB.settings.logo){$('setLogoPreview').src=DB.settings.logo;$('setLogoPreview').style.display='block'}
    refreshUI();
}
