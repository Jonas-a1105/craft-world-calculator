import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'es';

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation / Layout
    'nav.home': 'My Home',
    'nav.empire': 'Empire',
    'nav.planner': 'Planner',
    'nav.profitability': 'Profitability',
    'nav.calculator': 'Calculator',
    'nav.inventoryValue': 'Inventory Value',
    'nav.upgradeAdvisor': 'Upgrade Advisor',
    'nav.compare': 'Compare',
    'nav.timers': 'Timers',
    'nav.matrix': 'Matrix',
    'nav.settings': 'Settings',
    'nav.signOut': 'Sign Out',
    
    // SignIn
    'signin.title': 'Sign In',
    'signin.connectRonin': 'Connect Ronin Wallet',
    'signin.connectWC': 'Connect with WalletConnect',
    'signin.orPassword': 'Or use username and password',
    'signin.username': 'Username',
    'signin.password': 'Password',
    'signin.submit': 'Sign In',
    'signin.noWallet': 'Ronin Wallet was not detected. Install Ronin Wallet or open this app in a wallet enabled browser.',
    'signin.status.connecting': 'Requesting {label} connection...',
    'signin.status.payload': 'Requesting Craft World authentication payload...',
    'signin.status.sign': 'Please sign the Craft World login message.',
    'signin.status.auth': 'Authenticating with Craft World...',
    
    // Settings
    'settings.title': 'Settings',
    'settings.savedDesc': 'Saved player setup is stored locally in this browser and survives refreshes.',
    'settings.status.saved': 'Saved locally.',
    'settings.status.imported': 'Imported local config.',
    'settings.status.failed': 'Import failed: malformed JSON.',
    'settings.status.reset': 'Local config reset.',
    'settings.factoryResource': 'Factory / Resource',
    'settings.localSetup': '{token} Local Setup',
    'settings.ownedEnabled': 'Owned / enabled',
    'settings.factoryCount': 'Factory count',
    'settings.factoryLevel': 'Factory level',
    'settings.workersPercent': 'Workers %',
    'settings.workshopPercent': 'Workshop %',
    'settings.boostMultiplier': 'Boost multiplier',
    'settings.notes': 'Notes',
    'settings.importExport': 'Import / Export',
    'settings.exportJson': 'Export JSON',
    'settings.importJson': 'Import JSON',
    'settings.resetAll': 'Reset All',
    'settings.language': 'Language / Idioma',
    'settings.languageDesc': 'Select your preferred language / Selecciona tu idioma preferido:',
    'settings.english': 'English / Inglés',
    'settings.spanish': 'Spanish / Español',

    // Common / Global
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.enabled': 'Enabled',
    'common.level': 'Level',
    'common.error': 'Error',

    // Home / Dashboard
    'home.dashboard': 'Dashboard',
    'home.connectGame': 'Connect to Craft World',
    'home.connectDesc': 'Link your Craft World UID to import your in-game assets, factories, and levels automatically.',
    'home.saveUid': 'Save Craft World UID',
    'home.lastSynced': 'Last Synced',
    'home.profile': 'Profile',
    'home.roninWallets': 'Ronin Wallets',
    'home.activeFactories': 'Active Factories',
    'home.inventorySnapshot': 'Inventory Snapshot',
    'home.vaults': 'Vaults',
    'home.workshop': 'Workshop',
    'home.proficiencies': 'Proficiencies',
    'home.currencies': 'Currencies',
    'home.noFactories': 'No factories found yet.',
    'home.noInventory': 'No inventory found yet.',
    'home.noVaults': 'No vault data found yet.',
    'home.noWorkshop': 'No workshop data found yet.',
    'home.noProficiencies': 'No proficiency data found yet.',
    'home.noCurrencies': 'No currencies found yet.',
    'home.showingProf': 'Showing collected amount and claimed proficiency level returned by Craft World.',
    'home.resource': 'Resource',
    'home.collectedAmount': 'Collected Amount',
    'home.claimedLevel': 'Claimed Level',
    'home.nextVisibleLevel': 'Next Visible Level',
    'home.primary': 'Primary',
    'home.secondary': 'Secondary',
    'home.speed': 'Speed',
    'home.cyclesPerHour': 'Cycles per hour',
    'home.speedPercent': 'Speed %',
    'home.activeBoosts': 'Active Boosts',
    'home.noActiveBoosts': 'No active boosts',
    'home.duration': 'Duration',
    'home.runsPerHour': 'Runs per hour',
    'home.effectiveSpeed': 'Effective speed',
    'home.uidSaved': 'Craft World UID saved.',
    'home.uidSaveError': 'Unable to save Craft World UID.',
    'home.loadError': 'Unable to load dashboard data. Please try again.'
  },
  es: {
    // Navigation / Layout
    'nav.home': 'Mi Inicio',
    'nav.empire': 'Imperio',
    'nav.planner': 'Planificador',
    'nav.profitability': 'Rentabilidad',
    'nav.calculator': 'Calculadora',
    'nav.inventoryValue': 'Valor de Inventario',
    'nav.upgradeAdvisor': 'Asesor de Mejoras',
    'nav.compare': 'Comparador',
    'nav.timers': 'Temporizadores',
    'nav.matrix': 'Matriz',
    'nav.settings': 'Configuración',
    'nav.signOut': 'Cerrar Sesión',
    
    // SignIn
    'signin.title': 'Iniciar Sesión',
    'signin.connectRonin': 'Conectar Ronin Wallet',
    'signin.connectWC': 'Conectar con WalletConnect',
    'signin.orPassword': 'O usar usuario y contraseña',
    'signin.username': 'Usuario',
    'signin.password': 'Contraseña',
    'signin.submit': 'Entrar',
    'signin.noWallet': 'No se detectó Ronin Wallet. Instala Ronin Wallet o abre esta app en un navegador compatible.',
    'signin.status.connecting': 'Solicitando conexión de {label}...',
    'signin.status.payload': 'Solicitando datos de autenticación a Craft World...',
    'signin.status.sign': 'Por favor firma el mensaje de login en tu billetera.',
    'signin.status.auth': 'Autenticando con Craft World...',
    
    // Settings
    'settings.title': 'Configuración',
    'settings.savedDesc': 'La configuración del jugador se guarda localmente en este navegador y sobrevive a los reinicios.',
    'settings.status.saved': 'Guardado localmente.',
    'settings.status.imported': 'Configuración importada con éxito.',
    'settings.status.failed': 'Fallo al importar: JSON mal formado.',
    'settings.status.reset': 'Configuración local restablecida.',
    'settings.factoryResource': 'Fábrica / Recurso',
    'settings.localSetup': 'Ajustes locales de {token}',
    'settings.ownedEnabled': 'Poseído / Habilitado',
    'settings.factoryCount': 'Cantidad de fábricas',
    'settings.factoryLevel': 'Nivel de fábrica',
    'settings.workersPercent': '% Trabajadores',
    'settings.workshopPercent': '% Taller',
    'settings.boostMultiplier': 'Multiplicador de Boost',
    'settings.notes': 'Notas',
    'settings.importExport': 'Importar / Exportar',
    'settings.exportJson': 'Exportar JSON',
    'settings.importJson': 'Importar JSON',
    'settings.resetAll': 'Restablecer Todo',
    'settings.language': 'Idioma / Language',
    'settings.languageDesc': 'Selecciona tu idioma preferido / Select your preferred language:',
    'settings.english': 'Inglés / English',
    'settings.spanish': 'Español / Spanish',

    // Common / Global
    'common.loading': 'Cargando...',
    'common.save': 'Guardar',
    'common.enabled': 'Habilitado',
    'common.level': 'Nivel',
    'common.error': 'Error',

    // Home / Dashboard
    'home.dashboard': 'Panel de Control',
    'home.connectGame': 'Conectar a Craft World',
    'home.connectDesc': 'Vincula tu UID de Craft World para importar tus recursos, fábricas y niveles del juego automáticamente.',
    'home.saveUid': 'Guardar UID de Craft World',
    'home.lastSynced': 'Última Sincronización',
    'home.profile': 'Perfil',
    'home.roninWallets': 'Billeteras Ronin',
    'home.activeFactories': 'Fábricas Activas',
    'home.inventorySnapshot': 'Resumen de Inventario',
    'home.vaults': 'Bóvedas',
    'home.workshop': 'Taller',
    'home.proficiencies': 'Maestrías / Profesiones',
    'home.currencies': 'Monedas',
    'home.noFactories': 'Aún no se han encontrado fábricas.',
    'home.noInventory': 'Aún no se han encontrado recursos.',
    'home.noVaults': 'Aún no hay datos de bóvedas.',
    'home.noWorkshop': 'Aún no hay datos del taller.',
    'home.noProficiencies': 'Aún no hay datos de maestrías.',
    'home.noCurrencies': 'Aún no se han encontrado monedas.',
    'home.showingProf': 'Mostrando la cantidad recolectada y el nivel de maestría reclamado devuelto por Craft World.',
    'home.resource': 'Recurso',
    'home.collectedAmount': 'Cantidad Recolectada',
    'home.claimedLevel': 'Nivel Reclamado',
    'home.nextVisibleLevel': 'Siguiente Nivel Visible',
    'home.primary': 'Primario',
    'home.secondary': 'Secundario',
    'home.speed': 'Velocidad',
    'home.cyclesPerHour': 'Ciclos por hora',
    'home.speedPercent': 'Velocidad %',
    'home.activeBoosts': 'Boosts Activos',
    'home.noActiveBoosts': 'Sin boosts activos',
    'home.duration': 'Duración',
    'home.runsPerHour': 'Ejecuciones por hora',
    'home.effectiveSpeed': 'Velocidad efectiva',
    'home.uidSaved': 'UID de Craft World guardado.',
    'home.uidSaveError': 'No se pudo guardar el UID de Craft World.',
    'home.loadError': 'No se pudieron cargar los datos del panel. Por favor intenta de nuevo.'
  }
};

// Global automatic dictionary translation (English -> Spanish) for direct DOM values
const dictionaryTranslation: Record<Language, Record<string, string>> = {
  en: {},
  es: {
    // Shared text translations across other pages
    "Welcome back": "Bienvenido de nuevo",
    "Refresh Data": "Actualizar Datos",
    "Connect Craft World Identity": "Conectar Identidad de Craft World",
    "Craft World Profile": "Perfil de Craft World",
    "Unnamed player": "Jugador sin nombre",
    "Profile Wallet": "Billetera del Perfil",
    "Badges": "Insignias",
    "Craft World Wallets": "Billeteras de Craft World",
    "Primary": "Principal",
    "Type": "Tipo",
    "Provider": "Proveedor",
    "No provider": "Sin proveedor",
    "Craft World Connection": "Conexión de Craft World",
    "Live Craft World data is connected.": "Los datos en vivo de Craft World están conectados.",
    "Power": "Poder",
    "Skill Points": "Puntos de Habilidad",
    "Experience Points": "Puntos de Experiencia",
    "Primary Wallet": "Billetera Principal",
    "My Dynos": "Mis Dynos",
    "My Factories": "Mis Fábricas",
    "Inventory Snapshot": "Resumen de Inventario",
    "Vaults": "Bóvedas",
    "Workshop": "Taller",
    "Proficiencies": "Maestrías / Profesiones",
    "Currencies": "Monedas",
    "Not connected": "No conectado",
    "No Dynos found yet.": "No se encontraron Dynos.",
    "No factories found yet.": "No se encontraron fábricas.",
    "No inventory found yet.": "No se encontraron recursos.",
    "No vault data found yet.": "No se encontraron bóvedas.",
    "No workshop data found yet.": "No se encontraron talleres.",
    "No proficiency data found yet.": "No se encontraron maestrías.",
    "No currencies found yet.": "No se encontraron monedas.",
    "Showing collected amount and claimed proficiency level returned by Craft World.": "Mostrando la cantidad recolectada y el nivel de maestría reclamado devueltos por Craft World.",
    "Last synced": "Última sincronización",
    "Last Synced": "Última Sincronización",
    "Not set": "No establecido",

    // Empire Dashboard
    "Empire Dashboard": "Panel de Control del Imperio",
    "Summary": "Resumen",
    "Active Factories": "Fábricas Activas",
    "Weekly Cost": "Costo Semanal",
    "Monthly Cost": "Costo Mensual",
    "Production / Hour": "Producción / Hora",
    "Upgrade Progress": "Progreso de Mejoras",
    "Active Timers": "Temporizadores Activos",
    "Hourly Production": "Producción por Hora",
    "Daily Production": "Producción Diaria",
    "Active Boosts": "Boosts Activos",
    "Cycles per hour": "Ciclos por hora",
    "Speed %": "Velocidad %",
    "Duration": "Duración",
    "Runs per hour": "Ejecuciones por hora",
    "Effective speed": "Velocidad efectiva",
    "Tracked Factories": "Fábricas Monitoreadas",
    "Total Runs / Hour": "Ejecuciones Totales / Hora",
    "Boosted Factories": "Fábricas con Boost",
    "Output Tokens": "Fichas de Salida",
    "Next Best Action": "Siguiente Mejor Acción",
    "Top Producer": "Mayor Productor",
    "Live Production Per Hour / Day": "Producción en Vivo por Hora / Día",
    "Factory Comparison": "Comparación de Fábricas",
    "Rank": "Rango",
    "Factory": "Fábrica",
    "Output": "Resultado",
    "Runtime": "Ejecución",
    "Runs/Hr": "Ejec./Hr",
    "Output/Hr": "Prod./Hr",
    "Output/Day": "Prod./Día",
    "Active Boost": "Boost Activo",
    "No production totals available yet.": "No hay totales de producción disponibles aún.",
    "No factory rows matched the CSV yet.": "Ninguna fábrica coincide con el CSV aún.",
    "No factory production rows are ready yet.": "No hay filas de producción de fábrica listas aún.",

    // Resource Planner
    "Resource Planner": "Planificador de Recursos",
    "Target Resource": "Recurso Objetivo",
    "Target Amount": "Cantidad Objetivo",
    "Add Resource": "Añadir Recurso",
    "Clear Target": "Limpiar Objetivo",
    "Required Inputs": "Ingredientes Requeridos",
    "Opportunity Cost": "Costo de Oportunidad",
    "Total Cost": "Costo Total",
    "Total Profit": "Ganancia Total",
    "Amount Wanted": "Cantidad Deseada",
    "Want": "Objetivo",
    "Own": "Inventario",
    "Still Need": "Faltante",
    "ETA": "Tiempo Estimado (ETA)",
    "Ready now": "Listo ahora",
    "No producer": "Sin productor",
    "Production Source": "Fuente de Producción",
    "Recipe Tree / Base Resources": "Árbol de Recetas / Recursos Base",
    "Current producing level": "Nivel de producción actual",
    "Base runtime": "Tiempo de ejecución base",
    "Input": "Ingrediente 1",
    "Input 2": "Ingrediente 2",
    "Next upgrade": "Próxima mejora",
    "Base resources for 1 unit": "Recursos base para 1 unidad",
    "No recipe row found for that dropdown selection.": "No se encontró fila de receta para esa selección.",
    "Choose the resource, choose the factory level, then type the amount you want.": "Elige el recurso, elige el nivel de la fábrica y escribe la cantidad deseada.",

    // Profitability
    "Profitability Analysis": "Análisis de Rentabilidad",
    "Net Profit": "Ganancia Neta",
    "ROI": "Retorno de Inversión (ROI)",
    "Cost per Unit": "Costo por Unidad",
    "Market Price": "Precio de Mercado",
    "Buy Price": "Precio de Compra",
    "Sell Price": "Precio de Venta",
    "Estimate Profit": "Estimar Ganancia",
    "Profit Advisor": "Asesor de Rentabilidad",
    "All Matched Factories Ranked": "Clasificación de Fábricas Coincidentes",
    "Profit Per Hour": "Ganancia por Hora",
    "Profit Per Run": "Ganancia por Ejecución",
    "Input Buy Cost": "Costo de Compra",
    "Output Sell Value": "Valor de Venta",
    "Impact": "Impacto",
    "Status": "Estado",
    "Best visible craft right now": "Mejor fabricación visible ahora mismo",
    "Base Time": "Tiempo Base",
    "Output Time": "Tiempo Final",
    "Effective Speed": "Velocidad Efectiva",
    "Mastery": "Maestría",
    "Estimated profit per hour": "Ganancia estimada por hora",
    "Estimated profit per run": "Ganancia estimada por ejecución",
    "No fully quoted factory recommendation is available yet.": "No hay recomendación de fábrica cotizada disponible aún.",
    "Opportunity Cost / Manual Calculator": "Costo de Oportunidad / Calculadora Manual",

    // Production Calculator
    "Production Calculator": "Calculadora de Producción",
    "Calculate": "Calcular",
    "Outputs": "Resultados (Salida)",
    "Inputs": "Ingredientes (Entrada)",
    "Profit per Run": "Ganancia por Ejecución",
    "Profit per Hour": "Ganancia por Hora",

    // Inventory Value
    "Total Inventory Value": "Valor Total de Inventario",
    "Tokens": "Fichas",
    "Amount": "Cantidad",
    "Unit Value": "Valor Unitario",
    "Total Value": "Valor Total",

    // Upgrade Advisor
    "Upgrade Advisor": "Asesor de Mejoras",
    "Upgrade Step": "Paso de Mejora",
    "Cost": "Costo",
    "Material Required": "Material Requerido",
    "Available": "Disponible",
    "Missing": "Faltante",

    // Factory Compare
    "Compare Factories": "Comparar Fábricas",
    "Production Rate": "Tasa de Producción",

    // Factory Timers
    "Factory Timers": "Temporizadores de Fábricas",
    "Remaining Time": "Tiempo Restante",

    // Resource Matrix
    "Resource Matrix": "Matriz de Recursos",
    "Connections": "Conexiones"
  }
};

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved === 'es' || saved === 'en') return saved;
    return navigator.language.startsWith('es') ? 'es' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    // 1. Check direct translation mapping
    const dict = translations[language];
    let translation = dict[key] || translations['en'][key];

    // 2. Fall back to automatic dictionary translating for English strings
    if (!translation) {
      const autoDict = dictionaryTranslation[language];
      translation = autoDict?.[key] || key;
    }

    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        translation = translation.replace(`{${k}}`, String(v));
      });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
