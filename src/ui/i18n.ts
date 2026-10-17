import type { RiskLevel, Sensitivity, SignalDetail, SignalId, SignalMessageKey } from "../engine/types";

export type Locale = "en" | "es";
type Theme = "system" | "light" | "dark";

export interface Copy {
  locale: Locale;
  app: {
    documentTitle: string;
    tagline: string;
    themes: Record<Theme, string>;
    themeLabel: string;
    switchTheme: string;
    starOnGitHub: string;
    loadingModel: string;
    modelError: string;
    footerLicense: string;
    riskNote: string;
    howItWorks: string;
    limitations: string;
    reportProblem: string;
  };
  home: {
    eyebrow: string;
    title: string;
    titleEmphasis: string;
    lead: string;
    trust: string[];
    liveCall: { title: string; ready: string; unavailable: string; cta: string };
    recording: { title: string; body: string; cta: string; inputLabel: string };
    camera: { title: string; body: string; cta: string };
    howToCheck: string;
    steps: { number: string; title: string; body: string }[];
    whatItLooksFor: string;
    tells: { title: string; body: string }[];
    privacyTitle: string;
    privacyBody: string;
    safetyTitle: string;
    safetyBody: string;
  };
  session: {
    status: Record<"starting" | "running" | "paused" | "ended" | "error", string>;
    sources: Record<"file" | "camera" | "screen", string>;
    sensitivity: Record<Sensitivity, string>;
    resume: string;
    pause: string;
    settings: string;
    sensitivityLabel: string;
    strictHelp: string;
    showFaceBoxes: string;
    end: string;
    videoLabel: string;
    lookingForFace: string;
    noFaceHelp: string;
    startingVideo: string;
    zoomedSmallFace: string;
    selectedArea: string;
    useWholeVideo: string;
    dragTip: string;
    faceSingular: string;
    facePlural: string;
    inView: string;
    processedOnDevice: string;
    keepVisible: string;
    recordingFinished: string;
    sharingStopped: string;
    finalResults: string;
    results: string;
    noPeopleYet: string;
    headTurnCheck: string;
    headTurnPrompt: string;
    pressStart: string;
    startCheck: string;
    checkDone: string;
    recordingTurn: string;
    verifyAnotherWay: string;
    verifyTips: string[];
    saveReport: string;
    copySummary: string;
    videoPlaybackError: string;
    videoStartError: string;
    selectedAreaToast: string;
    reportSaved: string;
    summaryCopied: string;
    copyBlocked: string;
  };
  card: {
    person: string;
    personLabel: string;
    leftView: string;
    evidenceLabel: string;
    evidence: string;
    allSignals: string;
    waiting: string;
    weakEvidence: string;
    risk: string;
    analyzing: string;
    riskPercent: string;
    riskOverTime: string;
  };
  levels: Record<RiskLevel, { title: string; advice: string }>;
  signalLabels: Record<SignalId, string>;
  signalDetails: Record<SignalMessageKey, string>;
  errors: {
    cameraBlocked: string;
    screenCancelled: string;
    noCamera: string;
    cameraBusy: string;
    couldNotStart: string;
  };
  report: {
    header: string;
    noFaces: string;
    person: string;
    risk: string;
    evidence: string;
  };
}

const en: Copy = {
  locale: "en",
  app: {
    documentTitle: "Verilive — deepfake check",
    tagline: "deepfake check",
    themes: { system: "Auto", dark: "Dark", light: "Light" },
    themeLabel: "Theme: {theme}",
    switchTheme: "Switch theme",
    starOnGitHub: "Star on GitHub",
    loadingModel: "Loading the face model. The first visit takes a few seconds; after that it is cached.",
    modelError: "The face model could not load in this browser: {message}. Try a recent Chrome, Edge or Firefox.",
    footerLicense: "MIT licensed",
    riskNote: "Risk signals, not proof.",
    howItWorks: "How it works",
    limitations: "Limitations",
    reportProblem: "Report a problem",
  },
  home: {
    eyebrow: "Open-source deepfake check",
    title: "Is the person on your call",
    titleEmphasis: "really there?",
    lead: "Verilive watches a Zoom, Google Meet or Teams call and looks for signs of a face swap: no pulse in the skin, unnatural blinking, and a face that breaks apart when the head turns. Everything runs in this browser tab.",
    trust: ["Video never leaves your computer", "No account, no install", "Free and open source (MIT)"],
    liveCall: {
      title: "Check a live call",
      ready: "Share the call window. Verilive analyzes the people you can see.",
      unavailable: "Needs a desktop browser such as Chrome, Edge or Firefox.",
      cta: "Choose call window",
    },
    recording: { title: "Analyze a recording", body: "Open a video file of a call or a clip someone sent you. It stays on this device.", cta: "Choose video file", inputLabel: "Choose a video file to analyze" },
    camera: { title: "Try it on yourself", body: "See how a real face scores using your own camera. Nothing is recorded.", cta: "Use my camera" },
    howToCheck: "How to check a call",
    steps: [
      { number: "01", title: "Start the call as usual", body: "Use the Zoom, Teams or Webex app, or Meet in your browser. Spotlight or pin the person you want to check." },
      { number: "02", title: "Share the call window here", body: "Click “Check a live call” and pick the call window. Verilive only reads the picture; it cannot see anything else." },
      { number: "03", title: "Watch the result", body: "After about 15 seconds each person gets a reading. For a stronger test, ask them to turn their head slowly to each side." },
    ],
    whatItLooksFor: "What it looks for",
    tells: [
      { title: "A heartbeat in the skin", body: "Real skin changes colour very slightly with every heartbeat. Replayed and generated faces rarely do." },
      { title: "Natural blinking", body: "People blink irregularly, with both eyes, several times a minute." },
      { title: "A pasted-on face", body: "Swapped faces are often softer than the skin around them and flicker in colour." },
      { title: "Shape stability", body: "The geometry of a real face moves smoothly. Swaps tend to shimmer." },
      { title: "The head-turn test", body: "Face swaps are built from front-facing photos and break down when the head turns." },
    ],
    privacyTitle: "Private by design",
    privacyBody: "The face model and all analysis run inside this page. No video, images or audio are uploaded, and the page has no server to send them to.",
    safetyTitle: "Signals, not proof.",
    safetyBody: "Bad lighting, heavy compression or beauty filters can make a real person look suspicious, and new deepfakes may pass. If a call asks for money, passwords or urgent action, verify the person another way, whatever the score says.",
  },
  session: {
    status: { starting: "Starting", running: "Analyzing", paused: "Paused", ended: "Finished", error: "Error" },
    sources: { file: "Video file", camera: "Your camera", screen: "Shared window" },
    sensitivity: { relaxed: "Relaxed", balanced: "Balanced", strict: "Strict" },
    resume: "Resume", pause: "Pause", settings: "Settings", sensitivityLabel: "Sensitivity",
    strictHelp: "Strict flags sooner but has more false alarms.", showFaceBoxes: "Show face boxes on the video", end: "End",
    videoLabel: "Video being analyzed", lookingForFace: "Looking for a face",
    noFaceHelp: "Make sure the call window shows someone’s video, not just their name. Spotlight or pin the person for the best result.",
    startingVideo: "Starting video", zoomedSmallFace: "Zoomed in automatically on a small face.",
    selectedArea: "Analyzing the area you selected.", useWholeVideo: "Use whole video", dragTip: "Tip: drag a box around a person to focus on them.",
    faceSingular: "face", facePlural: "faces", inView: "in view", processedOnDevice: "Processed on this device",
    keepVisible: "Keep this tab visible (put it next to the call) so analysis keeps running.",
    recordingFinished: "Recording finished", sharingStopped: "Sharing stopped",
    finalResults: "The results below are final for this session. Save a report if you need a record.",
    results: "Results", noPeopleYet: "Each person on screen gets a card here once their face is found.",
    headTurnCheck: "Head-turn check", headTurnPrompt: "Ask them: “Could you slowly turn your head to the left, then to the right?”",
    pressStart: "Press start while they do it.", startCheck: "Start {seconds}-second check",
    checkDone: "Done. The head-turn result is in each person’s signals.",
    recordingTurn: "Recording the head turn. Keep the face in view.", verifyAnotherWay: "Verify another way",
    verifyTips: [
      "Hang up and call back on a number you already have.",
      "Ask something only the real person would know.",
      "Ask them to wave a hand slowly in front of their face.",
      "Never move money or share codes because of a video call alone.",
    ],
    saveReport: "Save report", copySummary: "Copy summary",
    videoPlaybackError: "This video could not be played. Try an MP4 or WebM file, or another browser.",
    videoStartError: "Could not start the video: {message}",
    selectedAreaToast: "Analyzing the selected area", reportSaved: "Report saved", summaryCopied: "Summary copied", copyBlocked: "Copy is blocked in this browser",
  },
  card: {
    person: "Person", personLabel: "Person {person}: {level}", leftView: "left the view", evidenceLabel: "Evidence collected",
    evidence: "Evidence collected · {percent}%", allSignals: "All signals", waiting: "waiting",
    weakEvidence: "weak evidence", risk: "{percent}% risk", analyzing: "Analyzing",
    riskPercent: "Risk {percent} percent", riskOverTime: "Risk over time",
  },
  levels: {
    collecting: { title: "Analyzing", advice: "Keep the person’s face visible. A first reading takes about 15 seconds." },
    low: { title: "No signs detected so far", advice: "No signs of a synthetic face have been detected so far. Stay alert if they ask for money, passwords or urgent action." },
    elevated: { title: "Some warning signs", advice: "Run a head-turn check and verify who they are another way before acting on anything." },
    high: { title: "Likely synthetic", advice: "Do not share information or send money. Hang up and contact the person through a number you already know." },
  },
  signalLabels: {
    pulse: "Pulse in skin colour", blink: "Blinking", texture: "Face sharpness match",
    flicker: "Colour flicker at face edge", jitter: "Face shape stability", pose: "Head-turn test",
  },
  signalDetails: {
    "pulse.collecting": "Collecting a few seconds of skin colour to look for a pulse.",
    "pulse.natural": "Natural pulse found (about {bpm} bpm) and the face regions beat together.",
    "pulse.weak": "Weak pulse signal. This is common with heavy video compression or poor lighting.",
    "pulse.absent": "No consistent pulse in the skin colour, as seen in replayed or generated faces.",
    "blink.collecting": "Watching blinks for a little longer.",
    "blink.noneYet": "No blinks yet in {seconds} seconds, which is still within the normal range.",
    "blink.oneNatural": "{count} natural-looking blink ({perMinute} per minute).",
    "blink.manyNatural": "{count} natural-looking blinks ({perMinute} per minute).",
    "blink.none": "No blinks in {seconds} seconds. People usually blink every few seconds.",
    "blink.regular": "Blinks happen at suspiciously regular intervals.",
    "blink.asymmetric": "The eyes often close separately, which is unusual for real blinks.",
    "blink.frequent": "Very frequent blinking ({perMinute} per minute).",
    "texture.collecting": "Comparing detail inside and around the face.",
    "texture.matches": "Detail inside the face matches the surrounding skin.",
    "texture.softer": "The inner face is a little softer than its surroundings. Beauty filters can also cause this.",
    "texture.blurry": "The inner face is much blurrier than the skin around it, a common face-swap artifact.",
    "flicker.collecting": "Watching for colour flicker around the face.",
    "flicker.together": "Skin colour inside and around the face moves together.",
    "flicker.changes": "The inner face changes colour on its own from frame to frame, which can mean it is being re-rendered.",
    "jitter.collecting": "Measuring how steady the face shape is.",
    "jitter.steady": "The face shape stays steady between frames.",
    "jitter.unstable": "The face shape wobbles between frames more than a real face does.",
    "pose.notTested": "Not tested yet. Ask them to turn their head slowly to each side.",
    "pose.moreFootage": "Need a little more footage of the head turned.",
    "pose.consistent": "The face stays consistent when the head turns.",
    "pose.unstable": "The face becomes unstable when the head turns, a common weakness of face swaps.",
  },
  errors: {
    cameraBlocked: "Camera access was blocked. Allow it from the browser’s address bar and try again.",
    screenCancelled: "Screen sharing was cancelled. Click “Check a live call” again and pick the call window.",
    noCamera: "No camera was found on this device.",
    cameraBusy: "The camera is busy in another app. Close it there and try again.",
    couldNotStart: "Could not start: {message}",
  },
  report: {
    header: "Verilive check · {date} · {minutes} min · {source}",
    noFaces: "No faces were analyzed.",
    person: "Person {person}: {verdict}",
    risk: "risk {percent}%",
    evidence: "evidence {percent}%",
  },
};

const es: Copy = {
  locale: "es",
  app: {
    documentTitle: "Verilive — detector de deepfakes",
    tagline: "detector de deepfakes",
    themes: { system: "Automático", dark: "Oscuro", light: "Claro" },
    themeLabel: "Tema: {theme}",
    switchTheme: "Cambiar tema",
    starOnGitHub: "Dale una estrella en GitHub",
    loadingModel: "Cargando el modelo facial. La primera visita tarda unos segundos; después queda en caché.",
    modelError: "No se pudo cargar el modelo facial en este navegador: {message}. Prueba con una versión reciente de Chrome, Edge o Firefox.",
    footerLicense: "Licencia MIT",
    riskNote: "Señales de riesgo, no pruebas.",
    howItWorks: "Cómo funciona",
    limitations: "Limitaciones",
    reportProblem: "Informar de un problema",
  },
  home: {
    eyebrow: "Detector de deepfakes de código abierto",
    title: "¿La persona de tu videollamada",
    titleEmphasis: "está realmente ahí?",
    lead: "Verilive analiza llamadas de Zoom, Google Meet o Teams y busca indicios de una sustitución de rostro: ausencia de pulso en la piel, parpadeo poco natural y un rostro que se deforma al girar la cabeza. Todo el análisis se ejecuta en esta pestaña del navegador.",
    trust: ["El video nunca sale de tu equipo", "Sin cuenta ni instalación", "Gratis y de código abierto (MIT)"],
    liveCall: {
      title: "Analizar una llamada en directo",
      ready: "Comparte la ventana de la llamada. Verilive analiza a las personas que aparecen.",
      unavailable: "Necesitas un navegador de escritorio, como Chrome, Edge o Firefox.",
      cta: "Elegir ventana de llamada",
    },
    recording: { title: "Analizar una grabación", body: "Abre un video de una llamada o un clip que te hayan enviado. El archivo permanece en este dispositivo.", cta: "Elegir archivo de video", inputLabel: "Elegir un archivo de video para analizar" },
    camera: { title: "Pruébalo contigo", body: "Comprueba el resultado de un rostro real con tu propia cámara. No se graba nada.", cta: "Usar mi cámara" },
    howToCheck: "Cómo analizar una llamada",
    steps: [
      { number: "01", title: "Inicia la llamada como siempre", body: "Usa Zoom, Teams o Webex, o abre Meet en el navegador. Destaca o fija a la persona que quieras comprobar." },
      { number: "02", title: "Comparte aquí la ventana de la llamada", body: "Haz clic en “Analizar una llamada en directo” y elige la ventana. Verilive solo ve la imagen compartida." },
      { number: "03", title: "Observa el resultado", body: "Tras unos 15 segundos, cada persona tendrá una lectura. Para una comprobación más sólida, pídele que gire la cabeza despacio hacia ambos lados." },
    ],
    whatItLooksFor: "Qué analiza",
    tells: [
      { title: "Pulso en la piel", body: "La piel real cambia de color muy ligeramente con cada latido. En rostros reproducidos o generados, esos cambios suelen faltar." },
      { title: "Parpadeo natural", body: "Las personas parpadean varias veces por minuto, de forma irregular y con ambos ojos." },
      { title: "Rostro superpuesto", body: "Los rostros sustituidos suelen verse más borrosos que la piel que los rodea y pueden cambiar de color de forma intermitente." },
      { title: "Estabilidad de la forma", body: "La forma de un rostro real se mueve con suavidad. Los rostros sustituidos tienden a vibrar." },
      { title: "Prueba de giro de cabeza", body: "Las sustituciones de rostro suelen crearse a partir de fotos frontales y pueden deformarse al girar la cabeza." },
    ],
    privacyTitle: "Privacidad desde el diseño",
    privacyBody: "El modelo facial y todo el análisis se ejecutan en esta página. No se suben videos, imágenes ni audio; la página tampoco tiene un servidor al que enviarlos.",
    safetyTitle: "Señales, no pruebas.",
    safetyBody: "La mala iluminación, la compresión intensa o los filtros de belleza pueden hacer que una persona real parezca sospechosa, y algunos deepfakes nuevos pueden pasar inadvertidos. Si en una llamada te piden dinero, contraseñas o que actúes con urgencia, verifica la identidad por otra vía, sea cual sea el resultado.",
  },
  session: {
    status: { starting: "Iniciando", running: "Analizando", paused: "En pausa", ended: "Finalizada", error: "Error" },
    sources: { file: "Archivo de video", camera: "Tu cámara", screen: "Ventana compartida" },
    sensitivity: { relaxed: "Flexible", balanced: "Equilibrada", strict: "Estricto" },
    resume: "Reanudar", pause: "Pausar", settings: "Configuración", sensitivityLabel: "Sensibilidad",
    strictHelp: "El modo estricto alerta antes, pero produce más falsas alarmas.", showFaceBoxes: "Mostrar recuadros faciales en el video", end: "Finalizar",
    videoLabel: "Video analizado", lookingForFace: "Buscando un rostro",
    noFaceHelp: "Comprueba que la ventana de llamada muestre el video de alguien y no solo su nombre. Destaca o fija a la persona para obtener mejores resultados.",
    startingVideo: "Iniciando video", zoomedSmallFace: "Se amplió automáticamente un rostro pequeño.",
    selectedArea: "Analizando el área seleccionada.", useWholeVideo: "Usar el video completo", dragTip: "Consejo: dibuja un recuadro alrededor de una persona para enfocarla.",
    faceSingular: "rostro", facePlural: "rostros", inView: "en pantalla", processedOnDevice: "Procesado en este dispositivo",
    keepVisible: "Mantén visible esta pestaña (junto a la llamada) para que el análisis siga ejecutándose.",
    recordingFinished: "Grabación finalizada", sharingStopped: "Se dejó de compartir",
    finalResults: "Estos son los resultados finales de esta sesión. Guarda un informe si necesitas conservarlos.",
    results: "Resultados", noPeopleYet: "Aquí aparecerá una tarjeta por cada persona cuando se detecte su rostro.",
    headTurnCheck: "Prueba de giro de cabeza", headTurnPrompt: "Pídele: “¿Podrías girar la cabeza despacio hacia la izquierda y luego hacia la derecha?”",
    pressStart: "Pulsa Iniciar mientras lo hace.", startCheck: "Iniciar prueba de {seconds} segundos",
    checkDone: "Listo. El resultado de la prueba de giro aparece entre las señales de cada persona.",
    recordingTurn: "Registrando el giro de cabeza. Mantén el rostro a la vista.", verifyAnotherWay: "Verifica por otra vía",
    verifyTips: [
      "Cuelga y vuelve a llamar a un número que ya tengas.",
      "Pregunta algo que solo la persona real sabría.",
      "Pídele que mueva una mano despacio delante de la cara.",
      "No envíes dinero ni compartas códigos basándote solo en una videollamada.",
    ],
    saveReport: "Guardar informe", copySummary: "Copiar resumen",
    videoPlaybackError: "No se pudo reproducir este video. Prueba con un archivo MP4 o WebM, o con otro navegador.",
    videoStartError: "No se pudo iniciar el video: {message}",
    selectedAreaToast: "Analizando el área seleccionada", reportSaved: "Informe guardado", summaryCopied: "Resumen copiado", copyBlocked: "Este navegador no permite copiar",
  },
  card: {
    person: "Persona", personLabel: "Persona {person}: {level}", leftView: "salió de la vista", evidenceLabel: "Evidencia recopilada",
    evidence: "Evidencia recopilada · {percent}%", allSignals: "Todas las señales", waiting: "recopilando",
    weakEvidence: "poca evidencia", risk: "{percent}% de riesgo", analyzing: "Analizando",
    riskPercent: "Riesgo: {percent} por ciento", riskOverTime: "Riesgo a lo largo del tiempo",
  },
  levels: {
    collecting: { title: "Analizando", advice: "Mantén visible el rostro de la persona. La primera lectura tarda unos 15 segundos." },
    low: { title: "Sin indicios detectados por ahora", advice: "Hasta ahora no se han detectado indicios de un rostro sintético. Mantente alerta si te piden dinero, contraseñas o que actúes con urgencia." },
    elevated: { title: "Algunas señales de alerta", advice: "Haz la prueba de giro de cabeza y verifica la identidad por otra vía antes de actuar." },
    high: { title: "Probablemente sintético", advice: "No compartas información ni envíes dinero. Cuelga y contacta con la persona por un número que ya conozcas." },
  },
  signalLabels: {
    pulse: "Pulso en el color de la piel", blink: "Parpadeo", texture: "Nitidez del rostro",
    flicker: "Cambios de color en el borde del rostro", jitter: "Estabilidad de la forma facial", pose: "Prueba de giro de cabeza",
  },
  signalDetails: {
    "pulse.collecting": "Recopilando unos segundos del color de la piel para buscar el pulso.",
    "pulse.natural": "Se detectó un pulso natural (aprox. {bpm} lpm) y las zonas del rostro laten al mismo ritmo.",
    "pulse.weak": "La señal del pulso es débil. Esto suele ocurrir con mucha compresión de video o poca iluminación.",
    "pulse.absent": "No se detecta un pulso constante en el color de la piel, algo que puede ocurrir en rostros reproducidos o generados.",
    "blink.collecting": "Observando el parpadeo un poco más.",
    "blink.noneYet": "Aún no se ha detectado ningún parpadeo en {seconds} segundos; sigue dentro del intervalo normal.",
    "blink.oneNatural": "{count} parpadeo de aspecto natural ({perMinute} por minuto).",
    "blink.manyNatural": "{count} parpadeos de aspecto natural ({perMinute} por minuto).",
    "blink.none": "No hubo parpadeos en {seconds} segundos. Las personas suelen parpadear cada pocos segundos.",
    "blink.regular": "El parpadeo ocurre a intervalos demasiado regulares.",
    "blink.asymmetric": "A menudo los ojos se cierran por separado, algo poco habitual en un parpadeo real.",
    "blink.frequent": "Parpadeo muy frecuente ({perMinute} por minuto).",
    "texture.collecting": "Comparando el detalle del interior y del contorno del rostro.",
    "texture.matches": "El detalle del interior del rostro coincide con el de la piel que lo rodea.",
    "texture.softer": "El interior del rostro se ve algo más suave que el contorno. Los filtros de belleza también pueden causarlo.",
    "texture.blurry": "El interior del rostro está mucho más borroso que la piel de alrededor, un artefacto frecuente en las sustituciones de rostro.",
    "flicker.collecting": "Observando si cambia el color alrededor del rostro.",
    "flicker.together": "El color de la piel del interior y del contorno del rostro cambia al mismo tiempo.",
    "flicker.changes": "El interior del rostro cambia de color por separado entre fotogramas; podría estar renderizándose de nuevo.",
    "jitter.collecting": "Midiendo la estabilidad de la forma del rostro.",
    "jitter.steady": "La forma del rostro se mantiene estable entre fotogramas.",
    "jitter.unstable": "La forma del rostro vibra entre fotogramas más de lo esperado en un rostro real.",
    "pose.notTested": "Aún no se ha probado. Pídele que gire la cabeza despacio hacia ambos lados.",
    "pose.moreFootage": "Hace falta más video con la cabeza girada.",
    "pose.consistent": "El rostro se mantiene estable al girar la cabeza.",
    "pose.unstable": "El rostro pierde estabilidad al girar la cabeza, una debilidad frecuente en las sustituciones de rostro.",
  },
  errors: {
    cameraBlocked: "Se bloqueó el acceso a la cámara. Permítelo desde la barra de direcciones del navegador e inténtalo de nuevo.",
    screenCancelled: "Se canceló la pantalla compartida. Vuelve a pulsar “Analizar una llamada en directo” y elige la ventana de la llamada.",
    noCamera: "No se encontró ninguna cámara en este dispositivo.",
    cameraBusy: "Otra aplicación está usando la cámara. Ciérrala e inténtalo de nuevo.",
    couldNotStart: "No se pudo iniciar: {message}",
  },
  report: {
    header: "Análisis de Verilive · {date} · {minutes} min · {source}",
    noFaces: "No se analizaron rostros.",
    person: "Persona {person}: {verdict}",
    risk: "riesgo: {percent}%",
    evidence: "evidencia: {percent}%",
  },
};

export function resolveLocale(language: string | undefined): Locale {
  return language?.toLowerCase().split(/[-_]/, 1)[0] === "es" ? "es" : "en";
}

export function messagesFor(language: string | undefined): Copy {
  return resolveLocale(language) === "es" ? es : en;
}

export function formatMessage(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}

export function formatSignalDetail(copy: Copy, detail: SignalDetail): string {
  return formatMessage(copy.signalDetails[detail.key], detail.values);
}
