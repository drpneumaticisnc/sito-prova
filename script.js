// --- 1. CONFIGURAZIONE ---
const firebaseConfig = {
  apiKey: "AIzaSyD_suC0f5BdE-ZDV3idkZ-0HPlIjEt6DTU",
  authDomain: "dr-pneumatici-app.firebaseapp.com",
  projectId: "dr-pneumatici-app",
  storageBucket: "dr-pneumatici-app.firebasestorage.app",
  messagingSenderId: "434776513276",
  appId: "1:434776513276:web:52370fb79c6ab043319579"
};

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzs-Cxcpa8DpOJWOYELLZZmaddmLlm5UUW-VM04uz1d8kPowXTSExyJkQ9VlLaX3Skp/exec"; 

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', function() {
    
    // RIFERIMENTI DOM
    const dateInput = document.getElementById('booking-date');
    const slotsContainer = document.getElementById('slots-container');
    const timeInput = document.getElementById('selected-time');
    const serviceSelect = document.getElementById('service-type');
    const storageCheck = document.getElementById('storage-check');
    const storageForm = document.getElementById('storage-verification-form');
    const btnVerifica = document.getElementById('btn-verifica-gomme');
    const msgVerifica = document.getElementById('msg-verifica');
    const misuraInput = document.getElementById('dep-misura'); // Input misura cliente
    
    let isStorageVerified = false;

    // --- SETUP DATE ---
    const today = new Date();
    dateInput.setAttribute('min', today.toISOString().split('T')[0]);
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 21);
    dateInput.setAttribute('max', maxDate.toISOString().split('T')[0]);

    // --- FUNZIONE FORMATTAZIONE MISURA (SOLO NUMERI) ---
    function formattaMisuraLive(inputElement) {
        inputElement.addEventListener('input', function(e) {
            // 1. Rimuove ISTANTANEAMENTE tutto ciò che non è un numero
            let value = e.target.value.replace(/\D/g, ''); 
            
            // Limitiamo la lunghezza massima
            if (value.length > 7) value = value.substring(0, 7);

            let formatted = '';

            // 2. Ricostruisce la stringa con la formattazione
            if (value.length > 0) formatted += value.substring(0, 3);
            if (value.length > 3) formatted += '/' + value.substring(3, 5);
            if (value.length > 5) formatted += ' R' + value.substring(5, 7);
            
            // 3. Sovrascrive il valore nel campo
            e.target.value = formatted;
        });
        
        // Listener per tasto INVIO nel campo misura
        inputElement.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault(); // Ferma l'invio del form principale
                btnVerifica.click(); // Clicca invece su "Verifica"
            }
        });
    }

    // Applica la formattazione al campo misura
    if(misuraInput) formattaMisuraLive(misuraInput);


    // --- GESTIONE LOGICA SERVIZI & DEPOSITO ---
    function checkStorageLogic() {
        if(!serviceSelect) return;
        const val = serviceSelect.value;
        const label = document.getElementById('label-storage');
        const hint = document.getElementById('storage-hint');

        if (val === "Cambio Gomme") {
            storageCheck.disabled = false;
            if(label) label.style.opacity = "1";
            if(hint) hint.style.display = "none";
        } else {
            storageCheck.checked = false;
            storageCheck.disabled = true;
            if(label) label.style.opacity = "0.5";
            storageForm.style.display = "none";
            isStorageVerified = true; 
            if(hint) hint.style.display = "block";
        }
    }

    // Attiva controllo logica al cambio e all'avvio
    if(serviceSelect) serviceSelect.addEventListener('change', checkStorageLogic);
    checkStorageLogic(); // Esegue subito per bloccare la checkbox all'avvio

    storageCheck.addEventListener('change', function() {
        if (this.checked) {
            storageForm.style.display = "block";
            isStorageVerified = false;
            document.getElementById('dep-nome').value = document.getElementById('nome').value;
            document.getElementById('dep-cognome').value = document.getElementById('cognome').value;
        } else {
            storageForm.style.display = "none";
            isStorageVerified = true;
        }
    });

    // --- LOGICA VERIFICA DATABASE ---
    if(btnVerifica) {
        btnVerifica.addEventListener('click', function(e) {
            e.preventDefault();
            const n = document.getElementById('dep-nome').value.toLowerCase().trim();
            const c = document.getElementById('dep-cognome').value.toLowerCase().trim();
            const mRaw = document.getElementById('dep-misura').value.trim();

            if(!n || !c || !mRaw) { alert("Compila tutti i dati per la verifica."); return; }

            // Pulisce la misura per il confronto (toglie spazi, /, R)
            const mUser = mRaw.toUpperCase().replace(/[\s\/R-]/g, '');

            msgVerifica.innerHTML = "🔍 Controllo magazzino...";
            msgVerifica.style.color = "blue";

            // Cerchiamo nel DB
            db.collection("deposito")
                .where("nome", "==", n)
                .where("cognome", "==", c)
                .get()
                .then(snap => {
                    if (snap.empty) {
                        msgVerifica.innerHTML = "❌ Cliente non trovato. Controlla i dati oppure contatta l'officina.";
                        msgVerifica.style.color = "red";
                        isStorageVerified = false;
                        return;
                    }

                    let found = false;
                    snap.forEach(doc => {
                        const dbMisura = doc.data().misura.toUpperCase().replace(/[\s\/R-]/g, '');
                        if(dbMisura.includes(mUser) || mUser.includes(dbMisura)) found = true;
                    });

                    if (found) {
                        msgVerifica.innerHTML = "✅ Gomme Trovate! Puoi procedere.";
                        msgVerifica.style.color = "green";
                        isStorageVerified = true;
                    } else {
                        msgVerifica.innerHTML = `⚠️ Cliente trovato, ma la misura non corrisponde.<br>Inserita: ${mRaw}`;
                        msgVerifica.style.color = "orange";
                        isStorageVerified = false;
                    }
                })
                .catch(err => {
                    console.error(err);
                    msgVerifica.innerHTML = "Errore di connessione.";
                });
        });
    }

    // --- ORARI LIVE ---
    dateInput.addEventListener('change', function() { caricaOrariLive(this.value); });

    function caricaOrariLive(dataScelta) {
        slotsContainer.innerHTML = "<p>Controllo orari...</p>";
        timeInput.value = "";
        const dayOfWeek = new Date(dataScelta).getDay();
        if (dayOfWeek === 0) { slotsContainer.innerHTML = "<p style='color:red;'>Chiusi la Domenica.</p>"; return; }

        db.collection("prenotazioni").where("data", "==", dataScelta).onSnapshot((snap) => {
            let occ = {};
            snap.forEach(d => { const dt = d.data(); occ[dt.ora] = (occ[dt.ora]||0)+1; });
            mostraBottoni(occ, dayOfWeek, dataScelta);
        });
    }

    function mostraBottoni(occ, day, dataScelta) {
        slotsContainer.innerHTML = "";
        let orari = (day === 6) ? ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"] : ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];
        
        const now = new Date();
        const limit = new Date(now.getTime() + (2 * 60 * 60 * 1000)); 

        orari.forEach(ora => {
            const btn = document.createElement('div');
            btn.className = 'time-slot';
            btn.textContent = ora;
            btn.style.cssText = "padding:10px; margin:5px; border:1px solid #2ca5ff; display:inline-block; cursor:pointer; border-radius:5px;";

            const [hh, mm] = ora.split(':');
            const [Y, M, D] = dataScelta.split('-');
            const slotDate = new Date(Y, M-1, D, hh, mm);

            if((occ[ora]||0) >= 2) {
                btn.style.background = "#ccc"; btn.style.color="#666"; btn.style.textDecoration="line-through";
            } else if (slotDate < limit) {
                btn.style.background = "#eee"; btn.style.color="#aaa";
            } else {
                if(timeInput.value === ora) { btn.style.background="#0a2342"; btn.style.color="white"; }
                btn.onclick = () => {
                    document.querySelectorAll('.time-slot').forEach(e => { if(e.style.background!=="rgb(204, 204, 204)") {e.style.background="white"; e.style.color="black";} });
                    btn.style.background="#0a2342"; btn.style.color="white";
                    timeInput.value = ora;
                };
            }
            slotsContainer.appendChild(btn);
        });
    }

    // --- INVIO FORM ---
    const form = document.getElementById('booking-form');
    if(form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // RESET ERRORI
            document.querySelectorAll('input').forEach(i => i.style.border = "1px solid #ccc");
            document.getElementById('err-email').style.display = "none";
            document.getElementById('err-tel').style.display = "none";

            const email = document.getElementById('email').value;
            const tel = document.getElementById('telefono').value;
            const orario = timeInput.value;
            const nome = document.getElementById('nome').value;
            const cognome = document.getElementById('cognome').value;
            const serv = serviceSelect.value;
            
            // VALIDAZIONE
            let valid = true;
            if(!orario) { alert("Scegli un orario"); return; }
            if(storageCheck.checked && !isStorageVerified) { 
                alert("⛔️ Devi verificare le gomme in magazzino!\nClicca il tasto blu VERIFICA."); 
                document.getElementById('storage-verification-form').scrollIntoView({behavior:'smooth'});
                return; 
            }
            if(!email.includes('@')) { document.getElementById('err-email').style.display="block"; valid=false; }
            if(tel.length < 9) { document.getElementById('err-tel').style.display="block"; valid=false; }

            if(!valid) return;

            const btn = document.querySelector('.btn-submit');
            btn.disabled = true;
            btn.textContent = "Controllo...";

            // OVERBOOKING CHECK
            db.collection("prenotazioni").where("data", "==", dateInput.value).where("ora", "==", orario).get()
            .then(snap => {
                if(snap.size >= 2) {
                    alert("⚠️ Orario appena occupato! Scegline un altro.");
                    btn.disabled = false;
                    btn.textContent = "CONFERMA PRENOTAZIONE";
                    caricaOrariLive(dateInput.value);
                    return;
                }

                const dataObj = {
                    nome: nome, cognome: cognome, email: email, telefono: tel,
                    servizio: serv, deposito: storageCheck.checked,
                    data: dateInput.value, ora: orario, 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    calendar_link: `https://www.google.com/calendar/render?action=TEMPLATE&text=DR%20Pneumatici&dates=${dateInput.value.replace(/-/g,'')}T${orario.replace(':','')}00/${dateInput.value.replace(/-/g,'')}T${(parseInt(orario)+1)}0000&details=${serv}&location=Via%20Corato%2064`
                };

                // SALVA CLIENTE
                db.collection("clienti").doc(email).set({
                    nome: nome, cognome: cognome, email: email, telefono: tel, last_visit: new Date()
                }, { merge: true });

                // INVIA EMAIL E SALVA
                fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST', mode: 'no-cors', 
                    headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dataObj)
                })
                .then(() => db.collection("prenotazioni").add(dataObj))
                .then(() => {
                    document.getElementById('booking-form-container').style.display='none';
                    document.getElementById('receipt-container').style.display='block';
                    document.getElementById('rec-name').textContent = nome + " " + cognome;
                    document.getElementById('rec-date').textContent = dateInput.value;
                    document.getElementById('rec-time').textContent = orario;
                    document.getElementById('rec-service').textContent = serv;
                    document.getElementById('rec-storage').textContent = storageCheck.checked ? "Sì" : "No";
                    document.getElementById('rec-email').textContent = email;
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                })
                .catch(err => { console.error(err); alert("Errore tecnico"); btn.disabled=false; });
            });
        });
    }
});
