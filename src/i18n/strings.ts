/**
 * Every word the app says, in six languages.
 *
 * English is the source and the fallback: `Key` is derived from it, so adding a
 * string without translating it is a type error in five files, and shipping a
 * missing one is impossible rather than merely unlikely.
 *
 * The five translations are a first pass by me and want a native read before
 * they ship, which is exactly what the "Improve the translation" row in the
 * support sheet is for. Preset names (Aurora, Haze, Ink, Ember, Moss) are not
 * translated: they are names.
 *
 * `{n}` and `{px}` are replaced by `t()`.
 */
export const en = {
  wallpaper: "Wallpaper",
  export: "Export",
  corner: "Corner",
  done: "Done",

  familyFade: "Fade",
  familyBar: "Band",
  familyStripes: "Blinds",

  style: "Style",
  curveStraight: "Straight fade",
  curveSoftTop: "Soft at the top",
  curveSoftBoth: "Soft at both ends",

  addPoint: "Add a point",
  deletePoint: "Delete this point",
  delete: "Delete",
  meshHintIdle: "Tap a point to pick it up",
  meshHintPicked: "Drag anywhere to move it, long press it for options",
  chooseColor: "Choose color",
  brightness: "Brightness",
  hue: "Hue",
  saturation: "Saturation",

  choosePhoto: "Choose a photo",
  photoInUse: "In use. Pinch the wallpaper to frame it",
  photoFromLibrary: "From your library",
  gradients: "Gradients",
  editColours: "Edit the colours",
  editColoursHint: "{n} colours, drag them where you want them",
  pickGradientFirst: "Pick a gradient first",
  effects: "Effects",

  compare: "Compare",
  compareHint: "Preview only. The export is the whole wallpaper.",
  saveToPhotos: "Save to Photos",
  rendering: "Rendering…",
  share: "Share",
  exportSpec: "PNG {px}, native resolution",
  exportHintIos:
    "Settings, then Wallpaper. Do not crop, and leave perspective zoom off: that is what shifts the mask.",
  exportHintAndroid:
    "Set it from your photos, as the home and lock screen. Do not crop and do not zoom: that is what shifts the mask.",

  theApp: "The app",
  support: "Support",
  supportHint: "Also opens when you shake the phone",
  watchDemo: "Watch the demo",
  watchDemoHint: "Touch anywhere to stop",

  emailSupport: "Email support",
  appWebsite: "App website",
  attached: "Attached to the email",
  improveTranslation: "Improve the translation",
  improveTranslationHint: "Tell me which wording to change",
  mailSupportSubject: "Hide The Notch, support",
  mailTranslationSubject: "Hide The Notch, translation",
  mailTranslationBody:
    "Which wording should change?\n\nWhat the app says:\n\nWhat it should say:\n\n",

  photoDenied: "Photo access denied",
  photoDeniedImport: "Allow access in Settings to import an image.",
  photoDeniedSave: "Allow access in Settings to save.",
  photoFailed: "That photo could not be opened",
  saved: "Saved",
  savedBodyIos:
    "{px} in your photos.\n\nSettings, then Wallpaper. Do not crop, and leave perspective zoom off.",
  savedBodyAndroid:
    "{px} in your photos.\n\nSet it from there as your wallpaper, without cropping and without zooming.",
  exportFailed: "Export failed",
  shareFailed: "Share failed",
  unknownError: "Unknown error",
} as const;

export type Key = keyof typeof en;
type Table = Record<Key, string>;

const fr: Table = {
  wallpaper: "Fond d'écran",
  export: "Exporter",
  corner: "Arrondi",
  done: "Terminé",

  familyFade: "Dégradé",
  familyBar: "Bandeau",
  familyStripes: "Stores",

  style: "Courbe",
  curveStraight: "Dégradé droit",
  curveSoftTop: "Adouci en haut",
  curveSoftBoth: "Adouci aux deux bouts",

  addPoint: "Ajouter un point",
  deletePoint: "Supprimer ce point",
  delete: "Supprimer",
  meshHintIdle: "Touchez un point pour le prendre",
  meshHintPicked: "Glissez n'importe où pour le déplacer, appui long pour les options",
  chooseColor: "Choisir une couleur",
  brightness: "Luminosité",
  hue: "Teinte",
  saturation: "Saturation",

  choosePhoto: "Choisir une photo",
  photoInUse: "Utilisée. Pincez le fond pour la cadrer",
  photoFromLibrary: "Depuis votre photothèque",
  gradients: "Dégradés",
  editColours: "Modifier les couleurs",
  editColoursHint: "{n} couleurs, placez-les où vous voulez",
  pickGradientFirst: "Choisissez d'abord un dégradé",
  effects: "Effets",

  compare: "Comparer",
  compareHint: "Aperçu seulement. L'export reste le fond d'écran entier.",
  saveToPhotos: "Enregistrer dans Photos",
  rendering: "Rendu…",
  share: "Partager",
  exportSpec: "PNG {px}, résolution native",
  exportHintIos:
    "Réglages, puis Fond d'écran. Ne recadrez pas, et laissez le zoom de perspective désactivé : c'est lui qui décale le masque.",
  exportHintAndroid:
    "Définissez-le depuis vos photos, en écran d'accueil et de verrouillage. Ne recadrez pas et ne zoomez pas : c'est ce qui décale le masque.",

  theApp: "L'app",
  support: "Assistance",
  supportHint: "S'ouvre aussi en secouant le téléphone",
  watchDemo: "Voir la démo",
  watchDemoHint: "Touchez l'écran pour arrêter",

  emailSupport: "Écrire à l'assistance",
  appWebsite: "Site de l'app",
  attached: "Joint au message",
  improveTranslation: "Améliorer la traduction",
  improveTranslationHint: "Dites-moi quel texte changer",
  mailSupportSubject: "Hide The Notch, assistance",
  mailTranslationSubject: "Hide The Notch, traduction",
  mailTranslationBody:
    "Quel texte faut-il changer ?\n\nCe que dit l'app :\n\nCe qu'elle devrait dire :\n\n",

  photoDenied: "Accès aux photos refusé",
  photoDeniedImport: "Autorisez l'accès dans Réglages pour importer une image.",
  photoDeniedSave: "Autorisez l'accès dans Réglages pour enregistrer.",
  photoFailed: "Cette photo n'a pas pu être ouverte",
  saved: "Enregistré",
  savedBodyIos:
    "{px} dans vos photos.\n\nRéglages, puis Fond d'écran. Ne recadrez pas, et laissez le zoom de perspective désactivé.",
  savedBodyAndroid:
    "{px} dans vos photos.\n\nDéfinissez-le de là comme fond d'écran, sans recadrer ni zoomer.",
  exportFailed: "Échec de l'export",
  shareFailed: "Échec du partage",
  unknownError: "Erreur inconnue",
};

const de: Table = {
  wallpaper: "Hintergrund",
  export: "Exportieren",
  corner: "Rundung",
  done: "Fertig",

  familyFade: "Verlauf",
  familyBar: "Balken",
  familyStripes: "Lamellen",

  style: "Kurve",
  curveStraight: "Gerader Verlauf",
  curveSoftTop: "Oben weich",
  curveSoftBoth: "Beidseitig weich",

  addPoint: "Punkt hinzufügen",
  deletePoint: "Diesen Punkt löschen",
  delete: "Löschen",
  meshHintIdle: "Tippe auf einen Punkt, um ihn zu greifen",
  meshHintPicked: "Zieh irgendwo, um ihn zu bewegen, lang drücken für Optionen",
  chooseColor: "Farbe wählen",
  brightness: "Helligkeit",
  hue: "Farbton",
  saturation: "Sättigung",

  choosePhoto: "Foto auswählen",
  photoInUse: "Wird verwendet. Zieh das Bild auf, um es zu setzen",
  photoFromLibrary: "Aus deiner Mediathek",
  gradients: "Verläufe",
  editColours: "Farben bearbeiten",
  editColoursHint: "{n} Farben, zieh sie dorthin, wo du sie willst",
  pickGradientFirst: "Wähle zuerst einen Verlauf",
  effects: "Effekte",

  compare: "Vergleichen",
  compareHint: "Nur die Vorschau. Exportiert wird das ganze Hintergrundbild.",
  saveToPhotos: "In Fotos speichern",
  rendering: "Wird gerendert…",
  share: "Teilen",
  exportSpec: "PNG {px}, native Auflösung",
  exportHintIos:
    "Einstellungen, dann Hintergrundbild. Nicht zuschneiden und den Perspektiven-Zoom auslassen: der verschiebt die Maske.",
  exportHintAndroid:
    "Aus deinen Fotos als Start- und Sperrbildschirm festlegen. Nicht zuschneiden und nicht zoomen: das verschiebt die Maske.",

  theApp: "Die App",
  support: "Hilfe",
  supportHint: "Öffnet sich auch, wenn du das Telefon schüttelst",
  watchDemo: "Demo ansehen",
  watchDemoHint: "Zum Anhalten den Bildschirm berühren",

  emailSupport: "E-Mail an den Support",
  appWebsite: "Website der App",
  attached: "Der E-Mail beigefügt",
  improveTranslation: "Übersetzung verbessern",
  improveTranslationHint: "Sag mir, welche Formulierung geändert werden soll",
  mailSupportSubject: "Hide The Notch, Support",
  mailTranslationSubject: "Hide The Notch, Übersetzung",
  mailTranslationBody:
    "Welche Formulierung soll geändert werden?\n\nWas die App sagt:\n\nWas sie sagen sollte:\n\n",

  photoDenied: "Zugriff auf Fotos verweigert",
  photoDeniedImport: "Erlaube den Zugriff in den Einstellungen, um ein Bild zu importieren.",
  photoDeniedSave: "Erlaube den Zugriff in den Einstellungen, um zu speichern.",
  photoFailed: "Dieses Foto konnte nicht geöffnet werden",
  saved: "Gespeichert",
  savedBodyIos:
    "{px} in deinen Fotos.\n\nEinstellungen, dann Hintergrundbild. Nicht zuschneiden und den Perspektiven-Zoom auslassen.",
  savedBodyAndroid:
    "{px} in deinen Fotos.\n\nVon dort als Hintergrundbild festlegen, ohne zuschneiden und ohne zoomen.",
  exportFailed: "Export fehlgeschlagen",
  shareFailed: "Teilen fehlgeschlagen",
  unknownError: "Unbekannter Fehler",
};

const es: Table = {
  wallpaper: "Fondo de pantalla",
  export: "Exportar",
  corner: "Redondeo",
  done: "Listo",

  familyFade: "Degradado",
  familyBar: "Banda",
  familyStripes: "Persiana",

  style: "Curva",
  curveStraight: "Degradado recto",
  curveSoftTop: "Suave arriba",
  curveSoftBoth: "Suave en ambos extremos",

  addPoint: "Añadir un punto",
  deletePoint: "Eliminar este punto",
  delete: "Eliminar",
  meshHintIdle: "Toca un punto para cogerlo",
  meshHintPicked: "Arrastra donde quieras para moverlo, pulsación larga para las opciones",
  chooseColor: "Elegir color",
  brightness: "Brillo",
  hue: "Tono",
  saturation: "Saturación",

  choosePhoto: "Elegir una foto",
  photoInUse: "En uso. Pellizca el fondo para encuadrarla",
  photoFromLibrary: "De tu fototeca",
  gradients: "Degradados",
  editColours: "Editar los colores",
  editColoursHint: "{n} colores, colócalos donde quieras",
  pickGradientFirst: "Elige primero un degradado",
  effects: "Efectos",

  compare: "Comparar",
  compareHint: "Solo la vista previa. Se exporta el fondo completo.",
  saveToPhotos: "Guardar en Fotos",
  rendering: "Renderizando…",
  share: "Compartir",
  exportSpec: "PNG {px}, resolución nativa",
  exportHintIos:
    "Ajustes, luego Fondo de pantalla. No recortes y deja el zoom de perspectiva desactivado: es lo que desplaza la máscara.",
  exportHintAndroid:
    "Establécelo desde tus fotos, como pantalla de inicio y de bloqueo. No recortes ni amplíes: eso desplaza la máscara.",

  theApp: "La app",
  support: "Soporte",
  supportHint: "También se abre al agitar el teléfono",
  watchDemo: "Ver la demo",
  watchDemoHint: "Toca la pantalla para parar",

  emailSupport: "Escribir al soporte",
  appWebsite: "Web de la app",
  attached: "Adjunto al correo",
  improveTranslation: "Mejorar la traducción",
  improveTranslationHint: "Dime qué texto hay que cambiar",
  mailSupportSubject: "Hide The Notch, soporte",
  mailTranslationSubject: "Hide The Notch, traducción",
  mailTranslationBody:
    "¿Qué texto hay que cambiar?\n\nLo que dice la app:\n\nLo que debería decir:\n\n",

  photoDenied: "Acceso a las fotos denegado",
  photoDeniedImport: "Permite el acceso en Ajustes para importar una imagen.",
  photoDeniedSave: "Permite el acceso en Ajustes para guardar.",
  photoFailed: "No se pudo abrir esta foto",
  saved: "Guardado",
  savedBodyIos:
    "{px} en tus fotos.\n\nAjustes, luego Fondo de pantalla. No recortes y deja el zoom de perspectiva desactivado.",
  savedBodyAndroid:
    "{px} en tus fotos.\n\nEstablécelo desde ahí como fondo de pantalla, sin recortar ni ampliar.",
  exportFailed: "Error al exportar",
  shareFailed: "Error al compartir",
  unknownError: "Error desconocido",
};

const ja: Table = {
  wallpaper: "壁紙",
  export: "書き出す",
  corner: "角丸",
  done: "完了",

  familyFade: "グラデーション",
  familyBar: "バー",
  familyStripes: "ブラインド",

  style: "カーブ",
  curveStraight: "直線的なぼかし",
  curveSoftTop: "上をやわらかく",
  curveSoftBoth: "両端をやわらかく",

  addPoint: "ポイントを追加",
  deletePoint: "このポイントを削除",
  delete: "削除",
  meshHintIdle: "ポイントをタップして選択",
  meshHintPicked: "どこでもドラッグして移動、長押しでオプション",
  chooseColor: "色を選択",
  brightness: "明度",
  hue: "色相",
  saturation: "彩度",

  choosePhoto: "写真を選択",
  photoInUse: "使用中。壁紙をピンチして構図を調整",
  photoFromLibrary: "ライブラリから",
  gradients: "グラデーション",
  editColours: "色を編集",
  editColoursHint: "{n}色、好きな位置にドラッグできます",
  pickGradientFirst: "先にグラデーションを選んでください",
  effects: "エフェクト",

  compare: "比較",
  compareHint: "プレビューのみ。書き出されるのは壁紙全体。",
  saveToPhotos: "写真に保存",
  rendering: "書き出し中…",
  share: "共有",
  exportSpec: "PNG {px}、実解像度",
  exportHintIos:
    "「設定」から「壁紙」へ。トリミングはせず、遠近ズームはオフのままにしてください。マスクがずれる原因になります。",
  exportHintAndroid:
    "写真アプリから、ホーム画面とロック画面に設定してください。トリミングやズームはしないでください。マスクがずれる原因になります。",

  theApp: "アプリについて",
  support: "サポート",
  supportHint: "端末を振っても開きます",
  watchDemo: "デモを見る",
  watchDemoHint: "画面をタッチすると止まります",

  emailSupport: "サポートにメール",
  appWebsite: "アプリのサイト",
  attached: "メールに添付されます",
  improveTranslation: "翻訳を改善する",
  improveTranslationHint: "直したい表現を教えてください",
  mailSupportSubject: "Hide The Notch、サポート",
  mailTranslationSubject: "Hide The Notch、翻訳",
  mailTranslationBody: "どの表現を直しますか？\n\nアプリの表示:\n\n正しい表現:\n\n",

  photoDenied: "写真へのアクセスが許可されていません",
  photoDeniedImport: "画像を読み込むには「設定」でアクセスを許可してください。",
  photoDeniedSave: "保存するには「設定」でアクセスを許可してください。",
  photoFailed: "この写真を開けませんでした",
  saved: "保存しました",
  savedBodyIos:
    "{px} を写真に保存しました。\n\n「設定」から「壁紙」へ。トリミングはせず、遠近ズームはオフのままにしてください。",
  savedBodyAndroid:
    "{px} を写真に保存しました。\n\nそこから壁紙に設定してください。トリミングやズームはしないでください。",
  exportFailed: "書き出しに失敗しました",
  shareFailed: "共有に失敗しました",
  unknownError: "不明なエラー",
};

const zhHans: Table = {
  wallpaper: "壁纸",
  export: "导出",
  corner: "圆角",
  done: "完成",

  familyFade: "渐变",
  familyBar: "色带",
  familyStripes: "百叶",

  style: "曲线",
  curveStraight: "线性渐隐",
  curveSoftTop: "顶部柔化",
  curveSoftBoth: "两端柔化",

  addPoint: "添加一个点",
  deletePoint: "删除这个点",
  delete: "删除",
  meshHintIdle: "轻点一个点来选中它",
  meshHintPicked: "在任意位置拖动即可移动，长按查看选项",
  chooseColor: "选择颜色",
  brightness: "亮度",
  hue: "色相",
  saturation: "饱和度",

  choosePhoto: "选择照片",
  photoInUse: "正在使用。双指缩放壁纸即可调整构图",
  photoFromLibrary: "来自你的图库",
  gradients: "渐变",
  editColours: "编辑颜色",
  editColoursHint: "{n} 种颜色，随意拖动到你想要的位置",
  pickGradientFirst: "请先选择一个渐变",
  effects: "效果",

  compare: "对比",
  compareHint: "仅预览。导出的是完整壁纸。",
  saveToPhotos: "存储到照片",
  rendering: "正在渲染…",
  share: "分享",
  exportSpec: "PNG {px}，原生分辨率",
  exportHintIos: "打开“设置”，再进入“墙纸”。不要裁剪，并关闭透视缩放：它会让遮罩偏移。",
  exportHintAndroid: "从相册中将它设为主屏幕和锁定屏幕壁纸。不要裁剪或缩放：这会让遮罩偏移。",

  theApp: "关于应用",
  support: "支持",
  supportHint: "摇动手机也会打开",
  watchDemo: "观看演示",
  watchDemoHint: "触摸屏幕即可停止",

  emailSupport: "给支持发邮件",
  appWebsite: "应用网站",
  attached: "将随邮件一起发送",
  improveTranslation: "改进翻译",
  improveTranslationHint: "告诉我哪句话需要修改",
  mailSupportSubject: "Hide The Notch，支持",
  mailTranslationSubject: "Hide The Notch，翻译",
  mailTranslationBody: "哪句话需要修改？\n\n应用显示的是：\n\n应该显示：\n\n",

  photoDenied: "照片访问被拒绝",
  photoDeniedImport: "请在“设置”中允许访问，以导入图片。",
  photoDeniedSave: "请在“设置”中允许访问，以进行存储。",
  photoFailed: "无法打开这张照片",
  saved: "已存储",
  savedBodyIos: "{px} 已存到你的照片。\n\n打开“设置”，再进入“墙纸”。不要裁剪，并关闭透视缩放。",
  savedBodyAndroid: "{px} 已存到你的相册。\n\n从那里将它设为壁纸，不要裁剪或缩放。",
  exportFailed: "导出失败",
  shareFailed: "分享失败",
  unknownError: "未知错误",
};

/**
 * The six, in the order they were chosen: English is the floor, French costs
 * nothing, and the other four are the largest markets where an English listing
 * costs the most.
 */
export const TABLES = { en, fr, de, es, ja, "zh-Hans": zhHans } as const;

export type Locale = keyof typeof TABLES;
