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
    const targaInput = document.getElementById('dep-targa');
    
    let isStorageVerified = false;

    // --- SETUP DATE ---
    const today = new Date();
    dateInput.setAttribute('min', today.toISOString().split('T')[0]);
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 21);
    dateInput.setAttribute('max', maxDate.toISOString().split('T')[0]);

    // --- FORMATTAZIONE TARGA IN MAIUSCOLO ---
    if (targaInput) {
        targaInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
        });
        targaInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                btnVerifica.click();
            }
        });
    }

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

    if(serviceSelect) serviceSelect.addEventListener('change', checkStorageLogic);
    checkStorageLogic();

    storageCheck.addEventListener('change', function() {
        if (this.checked) {
            storageForm.style.display = "block";
            isStorageVerified = false;
            // Reset risultato precedente
            document.getElementById('deposito-result').style.display = 'none';
            msgVerifica.innerHTML = '';
            if(targaInput) targaInput.value = '';
        } else {
            storageForm.style.display = "none";
            isStorageVerified = true;
        }
    });

    // --- LOGICA VERIFICA DEPOSITO PER TARGA ---
    if(btnVerifica) {
        btnVerifica.addEventListener('click', function(e) {
            e.preventDefault();

            const targa = targaInput ? targaInput.value.trim().toUpperCase() : '';

            if(!targa) {
                alert("Inserisci la targa per effettuare la verifica.");
                return;
            }

            msgVerifica.innerHTML = "🔍 Controllo magazzino...";
            msgVerifica.style.color = "blue";
            document.getElementById('deposito-result').style.display = 'none';
            isStorageVerified = false;

            db.collection("deposito")
                .where("targa", "==", targa)
                .get()
                .then(snap => {
                    if (snap.empty) {
                        msgVerifica.innerHTML = "❌ Nessun deposito trovato per questa targa. Controlla i dati oppure contatta l'officina.";
                        msgVerifica.style.color = "red";
                        isStorageVerified = false;
                        return;
                    }

                    // Prende il primo documento trovato
                    const docData = snap.docs[0].data();
                    const nomeCliente = (docData.nome || '') + ' ' + (docData.cognome || '');
                    const misura = docData.misura || 'N/D';
                    const quantita = docData.quantita ? ' (n° ' + docData.quantita + ')' : '';

                    msgVerifica.innerHTML = "✅ Gomme trovate! Puoi procedere.";
                    msgVerifica.style.color = "green";

                    // Mostra i dati trovati
                    document.getElementById('dep-res-cliente').textContent = nomeCliente.trim();
                    document.getElementById('dep-res-misura').textContent = misura + quantita;
                    document.getElementById('deposito-result').style.display = 'block';

                    isStorageVerified = true;
                })
                .catch(err => {
                    console.error(err);
                    msgVerifica.innerHTML = "Errore di connessione. Riprova.";
                    msgVerifica.style.color = "red";
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
            document.querySelectorAll('input, select').forEach(i => i.classList.remove('input-error'));
            document.getElementById('err-email').style.display = "none";
            document.getElementById('err-email-confirm').style.display = "none";
            document.getElementById('err-tel').style.display = "none";
            document.getElementById('err-service').style.display = "none";

            const serv = serviceSelect.value;
            const nome = document.getElementById('nome').value.trim();
            const cognome = document.getElementById('cognome').value.trim();
            const email = document.getElementById('email').value.trim();
            const emailConfirm = document.getElementById('email-confirm').value.trim();
            const tel = document.getElementById('telefono').value.trim();
            const orario = timeInput.value;
            const data = dateInput.value;

            let valid = true;

            // Validazione servizio
            if(!serv) {
                document.getElementById('err-service').style.display = "block";
                document.getElementById('service-type').classList.add('input-error');
                valid = false;
            }

            // Validazione data
            if(!data) {
                dateInput.classList.add('input-error');
                valid = false;
            }

            // Validazione orario
            if(!orario) {
                alert("⚠️ Seleziona un orario disponibile.");
                return;
            }

            // Validazione deposito
            if(storageCheck.checked && !isStorageVerified) { 
                alert("⛔️ Devi verificare le gomme in magazzino!\nInserisci la targa e clicca VERIFICA."); 
                document.getElementById('storage-verification-form').scrollIntoView({behavior:'smooth'});
                return; 
            }

            // Validazione nome
            if(!nome) {
                document.getElementById('nome').classList.add('input-error');
                valid = false;
            }

            // Validazione cognome
            if(!cognome) {
                document.getElementById('cognome').classList.add('input-error');
                valid = false;
            }

            // Validazione email
            if(!email || !email.includes('@') || !email.includes('.')) {
                document.getElementById('err-email').style.display = "block";
                document.getElementById('email').classList.add('input-error');
                valid = false;
            }

            // Validazione conferma email
            if(!emailConfirm || email !== emailConfirm) {
                document.getElementById('err-email-confirm').style.display = "block";
                document.getElementById('email-confirm').classList.add('input-error');
                valid = false;
            }

            // Validazione telefono
            if(!tel || tel.length < 9) {
                document.getElementById('err-tel').style.display = "block";
                document.getElementById('telefono').classList.add('input-error');
                valid = false;
            }

            if(!valid) {
                // Scroll al primo campo con errore
                const primoErrore = document.querySelector('.input-error, [style*="border: 2px solid red"], [style*="border-color: red"]');
                if(primoErrore) primoErrore.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            const btn = document.querySelector('.btn-submit');
            btn.disabled = true;
            btn.textContent = "Controllo...";

            // OVERBOOKING CHECK
            db.collection("prenotazioni").where("data", "==", data).where("ora", "==", orario).get()
            .then(snap => {
                if(snap.size >= 2) {
                    alert("⚠️ Orario appena occupato! Scegline un altro.");
                    btn.disabled = false;
                    btn.textContent = "CONFERMA PRENOTAZIONE";
                    caricaOrariLive(data);
                    return;
                }

                const dataObj = {
                    nome: nome, cognome: cognome, email: email, telefono: tel,
                    servizio: serv, deposito: storageCheck.checked,
                    data: data, ora: orario, 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    calendar_link: `https://www.google.com/calendar/render?action=TEMPLATE&text=DR%20Pneumatici&dates=${data.replace(/-/g,'')}T${orario.replace(':','')}00/${data.replace(/-/g,'')}T${(parseInt(orario)+1)}0000&details=${serv}&location=Via%20Corato%2064`
                };

                // SALVA CLIENTE
                db.collection("clienti").doc(email).set({
                    nome: nome, cognome: cognome, email: email, telefono: tel, last_visit: new Date()
                }, { merge: true });

                // SALVA PRENOTAZIONE, POI MANDA MAIL
                db.collection("prenotazioni").add(dataObj)
                .then((docRef) => {
                    dataObj.id_prenotazione = docRef.id;

                    return fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST', mode: 'no-cors', 
                        headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dataObj)
                    });
                })
                .then(() => {
                    // Mostra ricevuta e nasconde il form
                    document.getElementById('booking-form-container').style.display = 'none';
                    const receipt = document.getElementById('receipt-container');
                    receipt.style.display = 'block';

                    document.getElementById('rec-name').textContent = nome + " " + cognome;
                    document.getElementById('rec-date').textContent = data;
                    document.getElementById('rec-time').textContent = orario;
                    document.getElementById('rec-service').textContent = serv;
                    document.getElementById('rec-storage').textContent = storageCheck.checked ? "Sì" : "No";
                    document.getElementById('rec-email').textContent = email;

                    // MODIFICA: scroll alla ricevuta, non al top della pagina
                    receipt.scrollIntoView({ behavior: 'smooth', block: 'start' });
                })
                .catch(err => { console.error(err); alert("Errore tecnico"); btn.disabled=false; btn.textContent="CONFERMA PRENOTAZIONE"; });
            });
        });
    }
});