//=============================Tesla Ueberschussladen - TeslaChargejs==========================================
// V 1.9.3jb
// Stand:18.04.2023
// Fork: github.com/jensb/teslachargsjs

//=============================Einstellungen/Konfiguration=====================================================
//Wo soll das Skript die neuen Objekte anlegen (Mit PV-Überschuss geladene Energy.... )

const ID_SKRIPT_OBJEKT_VERZEICHNIS = "0_userdata.0.TeslaChargejs";
const ENTPRELL_ZEIT              = 0.5;  // Minuten Entprell Zeit (min), damit nicht mit jeder Wolke die Ladung unterbrochen wird
const MINDEST_EINSPEISE_LEISTUNG = 500;  // Welche Leistung (W) muss mindestens eingespeist werden, bevor das Skript das Laden (wieder) startet
const MINDEST_EINSPEISE_OHNE_AKKU= 3600; // Min Einspeisung, damit Laden auch bei leerem Hausakku startet
const MAXIMAL_NETZBEZUG          = 100;  // Wieiviel W darf aus dem Netz bezogen werden, bevor die Ladung abgebrochen wird.
const START_STROMSTAERKE         = 5;    // Mit welcher Stromstärke (A) soll das Laden begonnen werden
const MAX_STROMSTAERKE           = 16;   // Mit welcher Stromstärke (A) soll maximal geladen werden (Wird auch zum entladen des Hausakkus verwendet)
const NETZBEZUG_VERMEIDEN        = true; // Soll Netzbezug im Rahmen der Stromstärkenregulierung vermieden werden?
                                         // Wenn diese Option aktiviert ist wird die Stromstärke reduziert, sobald ein Strom aus dem Netz/AKku bezogen wird
let ID_EINSPEISE_LEISTUNG        = "plenticore.0.devices.local.ToGrid_P";  //IOBroker Objekt ID der Einspeiseleistung PV (W)

//IObroker Objekt ID der Netzbezugsleistung PV
// Leer lassen falls es nur ein Objekt für Netzbezug und Einspeiseleistung gibt und in ID_Einspeiseleistung das Objekt eintragen
// Das Skript erzeugt automatisch 2 Status für Einspeiseleistung und Netzbezug
// Falls der Wert positiv ist, wird der Wert als Netzbezug gespeichert, falls negativ als Einspeisung
let ID_NETZBEZUG_LEISTUNG        = "plenticore.0.devices.local.HomeGrid_P" ; // Watt
const ID_TSL                     = "tesla-motors.0.FILL_IN_VID_HERE_";  // IOBroker Objekt ID zum Tesla, generiert vom Tesla-Adatper (Root)
const ZUHAUSE_LATITUDE           = 52.xxxxx;                            // Breitengrad Koordinaten der Heimatadresse, somit greift das Skript nur Zuhause
const ZUHAUSE_LONGITUDE          = 12.xxxxx;                            // Längengrad Koordinaten
const ZUHAUSE_MAX_ENTFERNUNG     = 0.5 ;    // Maximale Entfernung (km) des Autos von Zuhause; Umkreis in dem das Skript greift
const LOGLEVEL                   = "INFO" ; // INFO oder DEBUG
const TELEGRAMM_NOTIFIZIERUNG    = false;   // true oder false <= Eine Telegram-Instanz muss in ioBroker eingerichtet sein
const TELEGRAMM_NUTZER           = "Elon";  // Nutzernamen oder ""
const PV_AKKU_VORHANDEN          = true;    // Ist ein PV-Akku vorhanden? Wenn nein, sind alle folgenden Angaben obsolet
const ID_PV_AKKU_SOC             = "plenticore.0.devices.local.battery.SoC";   // IOBroker ObjektID des Akkustands 
const PV_AKKU_START_SOC          = 22;     // Ab welchem Akkustand (%) des PV Akkus soll der Ladevorgang starten?
const PV_AKKU_STOP_SOC           = 15;     // Ab welchem Akkustand des PV Akkus soll der Ladevorgang Stoppen?
// const PV_AKKU_STOP_SOC_AFTERNOON = 70;     // Ab welchem Akkustand (%) des PV Akkus soll der Ladevorgang <6h vor Sonnenuntergang stoppen?
const PV_AKKU_STOP_SOC_EVENING   = 95;     // Ab welchem Akkustand (%) des PV Akkus soll der Ladevorgang <3h vor Sonnenuntergang stoppen?

//Gibt es 2 getrennte Objekte für Akku laden und entladen? Wenn ja, diesen Wert auf false setzen und die Objekte
//für Laden und Entladen des Akkus als ID_EINSPEISE_LEISTUNG (Laden) und ID_NETZBEZUG_LEISTUNG(Entladen) setzen
const PV_AKKU_LEISTUNG_EINSTATUS = false;        // true oder false
// Alles folgende ist nur notwendig, falls PV_AKKU_LEISTUNG_EINSTATUS = true 
const ID_PV_AKKU_STAT = "OBJEKT.PV.AKKU_STATUS"; // IOBroker ObjektID PV-Akku Status
const PV_AKKU_STAT_ENTLADEN = "Entladen";        // Welchen Wert hat das Objekt ID_PV_AKKU_STATUS wenn der Akku entladen wird?

//=============================Skript-Start=======================================
//=============================Konstanten=========================================
const ID_UEBERSCHUSSLADUNG_AKTIV =ID_SKRIPT_OBJEKT_VERZEICHNIS+".Ueberschussladung_aktiv";
const ID_HAUSAKKU_ENTLADEN = ID_SKRIPT_OBJEKT_VERZEICHNIS +".Hausakku_entladen";
const ID_ENERGY_ADDED_DAILY = ID_SKRIPT_OBJEKT_VERZEICHNIS+".energy_added_daily";
const ID_ENERGY_ADDED_MONTHLY = ID_SKRIPT_OBJEKT_VERZEICHNIS+".energy_added_monthly";
const ID_ENERGY_ADDED_YEARLY = ID_SKRIPT_OBJEKT_VERZEICHNIS+".energy_added_yearly";
const ID_CHARGING_PHASES = ID_SKRIPT_OBJEKT_VERZEICHNIS+".charging_phases";
const ID_CAR_STATE = ID_SKRIPT_OBJEKT_VERZEICHNIS+".car_state";
const ID_NETZBEZUG_DYNAMISCH = ID_SKRIPT_OBJEKT_VERZEICHNIS+".Netzbezug_dynamisch";
const ID_EINSPEISUNG_DYNAMISCH = ID_SKRIPT_OBJEKT_VERZEICHNIS+".Einspeisung_dynamisch";
const ID_TSL_STATE = ID_TSL + ".state";
const ID_TSL_LATITUDE = ID_TSL + ".drive_state.latitude";
const ID_TSL_LONGITUDE = ID_TSL + ".drive_state.longitude";
const ID_TSL_CHARGING_STATE= ID_TSL + ".charge_state.charging_state";
const ID_TSL_CMD_WAKEUP = ID_TSL + ".remote.wake_up";
const ID_TSL_CMD_SET_AMPS = ID_TSL + ".remote.set_charging_amps-charging_amps";
const ID_TSL_GET_AMPS = ID_TSL + ".charge_state.charge_amps";
const ID_TSL_CMD_CHARGE_START = ID_TSL + ".remote.charge_start";
const ID_TSL_CMD_CHARGE_STOP = ID_TSL + ".remote.charge_stop";
const ID_TSL_CHARGING_PHASES = ID_TSL + ".charge_state.charger_phases"; 
const ID_TSL_ADDED_ENERGY   = ID_TSL + ".charge_state.charge_energy_added";

//==============================letiablen=========================================
let timeout_running = false;
let Einspeiseleistung = 0;
let Netzbezug = 0;
let TeslaLadeLeistung = 0;
let chargedsofar = 0;
let added_energy_without_excess = 0;

//==============================Initialisierung===================================
// Erstellen von Status, sofern nicht vorhanden
// Mit Überschuss geladene Energy -> täglich, monatlich, jährlich
createState(ID_ENERGY_ADDED_DAILY,0, {unit: "kWh" , read: true, write: true});
createState(ID_ENERGY_ADDED_MONTHLY,0, {unit: "kWh" , read: true, write: true});
createState(ID_ENERGY_ADDED_YEARLY,0, {unit: "kWh" , read: true, write: true});

// Prüfen ob es getrennte Objekte für Einspeisung und Netzbezug gibt
// nur ein objekt für Einspeisung und Netzbezug)
if(ID_NETZBEZUG_LEISTUNG=="") {
  createState(ID_NETZBEZUG_DYNAMISCH,0, {unit: "W" , read: true, write: true});
  createState(ID_EINSPEISUNG_DYNAMISCH,0, {unit: "W" , read: true, write: true});
  let id_einspeiseleistung_org =  ID_EINSPEISE_LEISTUNG;
  ID_EINSPEISE_LEISTUNG = ID_EINSPEISUNG_DYNAMISCH;
  ID_NETZBEZUG_LEISTUNG = ID_NETZBEZUG_DYNAMISCH;
  on({id: id_einspeiseleistung_org,change: 'ne'}, function(obj){
    if(obj.state.val > 0 ) { //Netzbezug
      setState(ID_NETZBEZUG_LEISTUNG,obj.state.val);
      setState(ID_EINSPEISE_LEISTUNG,0);    
    } else if(obj.state.val < 0) {
      setState(ID_NETZBEZUG_LEISTUNG,0);
      setState(ID_EINSPEISE_LEISTUNG,obj.state.val * -1);   
    } else {
        setState(ID_NETZBEZUG_LEISTUNG,0);
        setState(ID_EINSPEISE_LEISTUNG,0);      
    }
  });
}

createState(ID_CHARGING_PHASES,0, {read: true, write: true});               // Phasen-Korrektur
createState(ID_CAR_STATE, {read: true, write: true});                       // Fahrzeug Status
createState(ID_UEBERSCHUSSLADUNG_AKTIV,true, {read: true, write: true});    // Ein/Ausschalten der Ueberschussladung 
createState(ID_HAUSAKKU_ENTLADEN,false, {read: true, write: true});         // Ein/Ausschalten der Hausakku-Entladen Funktion.  


//====================Events=======================================

/* TODO:
   Wenn Tesla verbunden & nicht voll ist, Plenticore-Akkumanagement auf "sofort laden" stellen,
   damit Teslacharge nicht auf den Hausakku wartet und der Hausakku auf die Mittagssonne.
   Wenn Tesla entfernt wird oder voll geladen ist, dann Plenticore wieder auf "nach Wetter laden" stellen.

   Alternativ (DONE):
   Wenn Einspeiseleistung >3600W, Laden starten egal wie voll der Hausakku ist.
*/


// Implementierung / Regelkreis
let trigger = [ID_EINSPEISE_LEISTUNG,ID_NETZBEZUG_LEISTUNG];

function log_all(charging_state) {
    log("Einspeise:" + Einspeiseleistung + ", Netzbezug: " + Netzbezug + ", Ü?:" + getState(ID_UEBERSCHUSSLADUNG_AKTIV).val +", Hausakku: " + getState(ID_PV_AKKU_SOC).val + "%, state:" +charging_state + 
        ", Strom: " + getState(ID_TSL_GET_AMPS).val + "A, Phasen T/JS: " + getState(ID_TSL_CHARGING_PHASES).val + "/" + getState(ID_CHARGING_PHASES).val + ", TeslaLadeLeistung: " + TeslaLadeLeistung, false); 
};

// Wenn sich die Einspeiseleistung oder Netzbezug ändert....
on({id: trigger,change: 'ne'}, function(obj){
    let charging_state = getState(ID_TSL_CHARGING_STATE).val;
    refresh_data();
    // log("home:" +at_home() + ", timeout:" + timeout_running + ", Überschuss?:" + getState(ID_UEBERSCHUSSLADUNG_AKTIV).val +", state: " +charging_state, false); 
    // log_all(charging_state);

    // Nur etwas tun, wenn das Auto mit Kabel verbunden, Ueberschussladen aktiv, Auto zuhause steht und gerade nicht auf eine Aktion gewartet wird
    if( isAstroDay() && charging_state != "Disconnected" && !timeout_running && !(getState(ID_UEBERSCHUSSLADUNG_AKTIV).val==false || getState(ID_UEBERSCHUSSLADUNG_AKTIV).val==0) &&  at_home()) {

        // Leistung einstellen (W). Wenn nur eine Phase, dann reduzieren
        let ampborder = 700;
        if(getState(ID_TSL_CHARGING_PHASES).val == 1) ampborder = 250;
        
        // Auto ist angeschlossen, lädt aber nicht
        if(charging_state == "Stopped") {

            // Mindesteinspeiseleistung erreicht ; Laden starten
            if( (Einspeiseleistung > MINDEST_EINSPEISE_LEISTUNG && is_startsoc_reached()) ||
                (Einspeiseleistung > MINDEST_EINSPEISE_OHNE_AKKU) ) {
                timeout_running = true;
                setTimeout(function(){
                    timeout_running = false;
                    refresh_data();
                    // prüfen ob Einspeiseleistung noch ausreichend -> Laden tatsächlich starten
                    if( (Einspeiseleistung > MINDEST_EINSPEISE_LEISTUNG && is_startsoc_reached()) ||
                        (Einspeiseleistung > MINDEST_EINSPEISE_OHNE_AKKU) ) { 

                        log_all(charging_state);
 
                        // Wenn das Auto schläft, dann vorher aufwecken und nach 30 Sekunden Ladung starten
                        if(getState(ID_TSL_STATE).val =="asleep") {
                            setState(ID_TSL_CMD_WAKEUP,true);
                            setStateDelayed(ID_TSL_CMD_CHARGE_START,true,30000);
                            setStateDelayed(ID_TSL_CMD_SET_AMPS,START_STROMSTAERKE,30000); 
                            log("Laden gestartet (verzögert)");
                        } else {
                            setState(ID_TSL_CMD_CHARGE_START,true);
                            setStateDelayed(ID_TSL_CMD_SET_AMPS,START_STROMSTAERKE,2000);
                            log("Laden gestartet",false,true);
                        }
                    }
                }, ENTPRELL_ZEIT * 60000);
            }
 
        // Auto ist angeschlossen und lädt
        } else if (charging_state == "Charging") {
           log("IsCharging",true);
           log("Einspeisung="+Einspeiseleistung + ", Netzbezug="+Netzbezug + ", TeslaLadeLeistung="+TeslaLadeLeistung, true);

            // Wenn PV-Akku ist unter Mindestschwelle
            if(is_stopsoc_reached()) {
                setState(ID_TSL_CMD_CHARGE_STOP,true);
                log_all(charging_state);
                log("Laden gestoppt, Akkustand PV zu niedrig",false,true);
            
            // Mehr als MINDEST_EINSPEISE_LEISTUNG Watt werden eingespeist
            } else if(Einspeiseleistung > ampborder) {
                if(getState(ID_TSL_GET_AMPS).val < MAX_STROMSTAERKE)
                {
                    timeout_running = true;
                    setTimeout(function() {
                        timeout_running = false;
                        refresh_data();
                        // Stromstärke erhöhen
                        if(Einspeiseleistung > ampborder) {
                            log_all(charging_state);
                            log("Einspeise_P=" + Einspeiseleistung + "W. Stromstärke wird von " + getState(ID_TSL_GET_AMPS).val + " A auf " + (getState(ID_TSL_GET_AMPS).val + 1) +" A erhöht.");
                            setState(ID_TSL_CMD_SET_AMPS, getState(ID_TSL_GET_AMPS).val + 1);
                        }
                    }, ENTPRELL_ZEIT * 60000);   
                }
            }

            // Die Funktion Hausakku_entladen ist nicht aktiv
            else if(!(getState(ID_HAUSAKKU_ENTLADEN).val==true || getState(ID_HAUSAKKU_ENTLADEN).val==1)) {
                
                // Stromstärke kann noch verringert werden
                if(getState(ID_TSL_GET_AMPS).val > START_STROMSTAERKE) { 
                    if(Netzbezug > ampborder  || (NETZBEZUG_VERMEIDEN && Netzbezug > 0))
                    { //Mehr als 250/700 Watt werden aus dem Netz bezogen oder Netzbezug vermeiden ist aktiviert und Netzbezug > 0
                        timeout_running = true;
                        setTimeout(function(){
                            timeout_running = false;
                            refresh_data();
                            if(Netzbezug > ampborder  || (NETZBEZUG_VERMEIDEN && Netzbezug > 0))
                            {// Stromstärke verringern
                                log_all(charging_state);
                                log("Einspeise_P=" + Einspeiseleistung + "W. Stromstärke wird von " + getState(ID_TSL_GET_AMPS).val + " A auf " + (getState(ID_TSL_GET_AMPS).val - 1) +" A verringert.");
                                setState(ID_TSL_CMD_SET_AMPS, getState(ID_TSL_GET_AMPS).val - 1);
                            }
                        },ENTPRELL_ZEIT * 60000);   
                    }

                // Laden muss evtl gestoppt werden
                } else {
                    if(Netzbezug > MAXIMAL_NETZBEZUG) { // Zu VielNetzbezug --> Laden abbrechen
                        timeout_running = true;
                        setTimeout(function(){
                            timeout_running = false;
                            refresh_data();

                            // Laden Stoppen 
                            if(Netzbezug > MAXIMAL_NETZBEZUG && getState(ID_TSL_GET_AMPS).val < 6) {
                                setState(ID_TSL_CMD_CHARGE_STOP,true);
                                log_all(charging_state);
                                log("Laden gestoppt, zu wenig PV-Leistung vorhanden",false,true);
                            }
                        }, ENTPRELL_ZEIT * 60000);
                    }
                }
            }
            // Hausakku entladen ist aktiv
            else if ((getState(ID_HAUSAKKU_ENTLADEN).val==true || getState(ID_HAUSAKKU_ENTLADEN).val==1)) {
                if(getState(ID_PV_AKKU_SOC).val < PV_AKKU_STOP_SOC + 3)
                {// 3 % vor Stop SoC wird Hausakku entladen wieder deaktiviert, damit die Ladung nicht gänzlich stoppt
                    setState(ID_HAUSAKKU_ENTLADEN,false);
                    log_all(charging_state);
                    log("Der Mindest SoC des Hausakku ist gleich erreicht. Hausakku-Entladen wird deaktiviert");
                }

            }
        }
    }
});
 

// Wenn überschussladung deaktiviert wird, dann Stromstärke wieder auf 16A setzen
on({id: ID_UEBERSCHUSSLADUNG_AKTIV, change: 'ne'}, function(obj){
    if(getState(ID_UEBERSCHUSSLADUNG_AKTIV).val == false || getState(ID_UEBERSCHUSSLADUNG_AKTIV).val == 0 )
        setState( ID_TSL_CMD_SET_AMPS,MAX_STROMSTAERKE); 
});


// Ladung beendet
on({id: ID_TSL_CHARGING_STATE, change: 'ne'}, function(obj){
    if((getState(ID_TSL_CHARGING_STATE).val=="Disconnected") &&  at_home())
    {// Wenn Laden gestoppt wurde, oder Kabel Disconnected --> Ladung addieren
        if(getState(ID_UEBERSCHUSSLADUNG_AKTIV).val==false || getState(ID_UEBERSCHUSSLADUNG_AKTIV).val==0)
        {// Wenn gerade keine Überschussladung aktiv --> Evtl vorher geladene Energy sichern
            added_energy_without_excess = getState(ID_TSL_ADDED_ENERGY).val;
            log("added_energy_without_excess save="+added_energy_without_excess,true);
        }
            log("CALC",true);
            calc_added_energy();
        // Hausakku entladen, deaktivieren
        setState(ID_HAUSAKKU_ENTLADEN,false);
    }
});

// Ladung startet
on({id: ID_TSL_CHARGING_STATE, oldVal: 'Disconnected'}, function(obj){ // Kabel wurde gerade erst verbunden
    if(getState(ID_TSL_CHARGING_STATE).val != "Disconnected" && !timeout_running && !(getState(ID_UEBERSCHUSSLADUNG_AKTIV).val==false || getState(ID_UEBERSCHUSSLADUNG_AKTIV).val==0) &&  at_home())
    {// Kabel wurde gerade angeschlossen und Überschussladung wird getriggert
        setStateDelayed(ID_TSL_CMD_SET_AMPS,START_STROMSTAERKE,30000); //Start Stromstärke einstellen
    }
});

on({id: ID_UEBERSCHUSSLADUNG_AKTIV, change: 'ne'}, function(obj){
    // Überschussladen wurde gerade aktiviert ...
    if((getState(ID_UEBERSCHUSSLADUNG_AKTIV).val == 1 || getState(ID_UEBERSCHUSSLADUNG_AKTIV).val ==true) && at_home() ) {
        // Und das Auto schon lädt, geladene kWh ohne Überschussladung sichern
        if(getState(ID_TSL_CHARGING_STATE).val != "Disconnected" ) {
            added_energy_without_excess = getState(ID_TSL_ADDED_ENERGY).val-chargedsofar;
            log("added_energy_without_excess="+added_energy_without_excess,true);
        }
    
    // Wurde gerade deaktiviert 
    } else if(at_home() && getState(ID_TSL_CHARGING_STATE).val!="Disconnected") {
        chargedsofar = getState(ID_TSL_ADDED_ENERGY).val - added_energy_without_excess;
        log("chargedsofar="+chargedsofar,true);
    }
});


// Phasen korrigieren (API bringt nur 1 oder 2)
on({id: [ID_TSL_CHARGING_PHASES, ID_TSL_CHARGING_STATE], change: 'ne'}, function(obj){
    if(getState(ID_TSL_CHARGING_PHASES).val == 1)
        setState(ID_CHARGING_PHASES,1);
    else if(getState(ID_TSL_CHARGING_PHASES).val == 2)
        setState(ID_CHARGING_PHASES,3);
    else
        setState(ID_CHARGING_PHASES,0);
});


//Auto-Status bestimmen
on({id: [ID_TSL_STATE,ID_TSL_CHARGING_STATE], change: 'ne'}, function(obj){
    if(getState(ID_TSL_CHARGING_STATE).val == "Charging")
        setState(ID_CAR_STATE,"Lädt");
    else if(getState(ID_TSL_STATE).val == "online")
        setState(ID_CAR_STATE,"Online");
    else if(getState(ID_TSL_STATE).val == "asleep")
        setState(ID_CAR_STATE,"Schläft");
    else
        setState(ID_CAR_STATE,"Unbekannt");
});


// Hausakku Entladen wird eingschalten
on({id: ID_HAUSAKKU_ENTLADEN, change: 'ne'}, function(obj){
    // wurde eingeschalten; Maximale Stromstärke setzen und evtl Ladung starten
    if(getState(ID_HAUSAKKU_ENTLADEN).val==true || getState(ID_HAUSAKKU_ENTLADEN).val==1) {
        if(getState(ID_TSL_CHARGING_STATE).val == "Stopped")
            setState(ID_TSL_CMD_CHARGE_START,true);
        setStateDelayed(ID_TSL_CMD_SET_AMPS,MAX_STROMSTAERKE,2000);   
    }
});


// Das Laden Stoppen, falls Nach Sonnenuntergang das Laden gestartet wurde und die Überschussladung aktiv ist
on({id:ID_TSL_CHARGING_STATE, change: 'ne'}, function(obj){
    if(getState(ID_TSL_CHARGING_STATE).val== "Charging" && !isAstroDay() && at_home() && !(getState(ID_UEBERSCHUSSLADUNG_AKTIV).val==false || getState(ID_UEBERSCHUSSLADUNG_AKTIV).val==0) ) {
        setState(ID_TSL_CMD_CHARGE_STOP,true);
        log("Das Laden wurde automatisch gestoppt - Es ist nach Sonnenuntergang und vor Sonnenaufgang",false,true);
    }
});


// Zeitpläne zum Berechnen der geladenen Energy, Rücksetzen der Werte
// PV-Überschuss Tageswert zurücksetzen jeden Tag um 00:01
schedule("1 0 * * *", function () { setState(ID_ENERGY_ADDED_DAILY,0); });
// PV-Überschuss Monatswert zurücksetzen , Immer am 1. des Monats um 00:01
schedule('1 0 1 * *', function () { setState(ID_ENERGY_ADDED_MONTHLY,0); });
// PV Jahreswert zurücksetzen Immer am 1.1. um 00:01
schedule('1 0 1 1 *', function () { setState(ID_ENERGY_ADDED_YEARLY,0); });

//=====================Hilfsfunktionen============================== 

// Umrechnung Grad in Radiat
function Deg2Rad( deg ) {
    return deg * Math.PI / 180;
}

// Working! 2023.05.04
function is_soon_sunset() {
    return compareTime({ astro: 'sunsetStart', offset: -180 }, 'sunset', '>');
}

// Set minimum home battery SoC to STOP charging to a dynamic value based on "when is sunset",
// so that the home battery isn't depleted by charging the car and has no time to recharge until sunset.
function dynamic_akku_soc(soc_normal, soc_evening) {
    var sunrise = getAstroDate('sunriseEnd').getTime();  // getTime() returns integer (millisecond epoch)
    var sunset = getAstroDate('sunsetStart').getTime();
    var total_sun_minutes = Math.abs(sunset - sunrise) / (1000*60) - 120;
    var upto_now_minutes = Math.abs((new Date()).getTime() - sunrise) / (1000*60);
    var minutes_percent = upto_now_minutes / total_sun_minutes;
    // log("dynamic_akku_soc(" + soc_normal + ", " + soc_evening + "): Sunset-120m in " + (total_sun_minutes-upto_now_minutes).toFixed(2) + " minutes, stop charging at SoC: " + minutes_percent.toFixed(2));
    return Math.max(soc_normal, Math.min(minutes_percent * 100, soc_evening));
}

// Three or less hours before sunset, only charge the car if the home battery is >=99% full.
function is_startsoc_reached() {
    let start_soc = is_soon_sunset() ? 99 : PV_AKKU_START_SOC;
    const tf = (getState(ID_PV_AKKU_SOC).val >= start_soc) || Einspeiseleistung > 3000;
    if(tf) log("Akku SoC ist >= " + getState(ID_PV_AKKU_SOC).val + "%, start SoC=" + start_soc + ", Einspeiseleistung = " + Einspeiseleistung + "W, starte Ladevorgang.");
    return PV_AKKU_VORHANDEN ? tf : true; // Wenn kein Akku vorhanden, immer true zurückliefern
}

// Stop charging at a home battery SoC set based on how far away sunset is.
function is_stopsoc_reached() {
    let stop_soc = dynamic_akku_soc(PV_AKKU_STOP_SOC, PV_AKKU_STOP_SOC_EVENING);
    const tf = (getState(ID_PV_AKKU_SOC).val <= stop_soc);
    if(tf) log("Akku SoC ist <= " + getState(ID_PV_AKKU_SOC).val + "%, dyn. Mindest-SoC=" + stop_soc.toFixed(2) + ", stoppe Ladevorgang.");
    return PV_AKKU_VORHANDEN ? tf : false; // Wenn kein Akku vorhanden, immer false zurückliefern
}

// Entfernung des Autos vom Heimstandort ermitteln
function at_home() {
    let lat1 = Deg2Rad(ZUHAUSE_LATITUDE);
    let lat2 = Deg2Rad(getState(ID_TSL_LATITUDE).val);
    let lon1 = Deg2Rad(ZUHAUSE_LONGITUDE);
    let lon2 = Deg2Rad(getState(ID_TSL_LONGITUDE).val);
    let R = 6371; // km
    let x = (lon2-lon1) * Math.cos((lat1+lat2)/2);
    let y = (lat2-lat1);
    let d = Math.sqrt(x*x + y*y) * R;

    return (d <= ZUHAUSE_MAX_ENTFERNUNG);
}

function calc_added_energy() {
    let energyadd=0;
    // Überschussladung gerade nicht aktiv
    if(!(getState(ID_UEBERSCHUSSLADUNG_AKTIV).val == 1 || getState(ID_UEBERSCHUSSLADUNG_AKTIV).val ==true)) {
        energyadd = parseFloat(getState(ID_TSL_ADDED_ENERGY).val) - added_energy_without_excess + chargedsofar;
    } else {
        energyadd = parseFloat(getState(ID_TSL_ADDED_ENERGY).val) - added_energy_without_excess;    
    }
    log("Charged so far: "+chargedsofar+ " ; added_energy_without excess="+ added_energy_without_excess, true);
    log("Energy add: "+energyadd,true); 
    log("New Daily="+(parseFloat(getState(ID_ENERGY_ADDED_DAILY).val) + energyadd).toFixed(2),true);
    log("New Monthly="+(parseFloat(getState(ID_ENERGY_ADDED_MONTHLY).val) + energyadd).toFixed(2),true);
    log("New Yearly="+(parseFloat(getState(ID_ENERGY_ADDED_YEARLY).val) + energyadd).toFixed(2),true);
    if(energyadd > 0) {
        log("Ladung beendet, es wurden " + energyadd + " kWh mit Überschuss geladen",false,true);
    }
    
    setState(ID_ENERGY_ADDED_DAILY,(parseFloat(getState(ID_ENERGY_ADDED_DAILY).val) + energyadd).toFixed(2));
    setStateDelayed(ID_ENERGY_ADDED_MONTHLY,(parseFloat(getState(ID_ENERGY_ADDED_MONTHLY).val) + energyadd).toFixed(2) ,500);
    setStateDelayed(ID_ENERGY_ADDED_YEARLY,(parseFloat(getState(ID_ENERGY_ADDED_YEARLY).val) + energyadd).toFixed(2), 1000);
    added_energy_without_excess = 0;
    chargedsofar = 0;
}

function refresh_data() {
    TeslaLadeLeistung = getState(ID_TSL_GET_AMPS).val * getState(ID_CHARGING_PHASES).val * 240;
    
    // Wenn es nur ein Objekt für Laden + Entladen gibt
    if(PV_AKKU_VORHANDEN && PV_AKKU_LEISTUNG_EINSTATUS) {
        if(getState(ID_PV_AKKU_STAT).val != PV_AKKU_STAT_ENTLADEN) {
            Einspeiseleistung = getState(ID_EINSPEISE_LEISTUNG).val;
            Netzbezug = 0;
        } else {
            Netzbezug = getState(ID_EINSPEISE_LEISTUNG).val;
            Einspeiseleistung = 0;
        }
    
    // kein Akku vorhanden, Einspeiseleistung normal setzen
    } else {
        Einspeiseleistung = getState(ID_EINSPEISE_LEISTUNG).val;
        Netzbezug = getState(ID_NETZBEZUG_LEISTUNG).val;   
    }
    // log("P=" + Einspeiseleistung + ", I_Tesla=" + getState(ID_TSL_GET_AMPS).val + ", Netzbezug: " + Netzbezug, false, false);
}


function log(logtext,debug=false,Telegramm=false) {
    if(!debug || (debug && LOGLEVEL == "DEBUG")) {
        console.log(logtext);    
        if(Telegramm && TELEGRAMM_NOTIFIZIERUNG) {

            // Wenn Nutzer angegeben, nur an diesen Nutzer senden
            if(TELEGRAMM_NUTZER != "") {
                sendTo('telegram',"@" + TELEGRAMM_NUTZER + " TeslaChargejs: " +logtext);
            // Sonst an alle
            } else {
                sendTo('telegram',"TeslaChargejs: " + logtext);
            }

        }
    }
}
