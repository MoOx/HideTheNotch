const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Coupe `lintVital` sur les builds Android release.
 *
 * AGP lance automatiquement `lintVitalAnalyzeRelease` sur un build release, y
 * compris dans les modules des dépendances. `react-native-skia` et
 * `expo-modules-core` y échouent pour des raisons qui ne concernent en rien
 * cette app, et le build s'arrête là.
 *
 * Le projet natif étant régénéré par `expo prebuild` à chaque build, patcher le
 * `build.gradle` à la main n'aurait aucun effet durable : d'où ce plugin.
 *
 * On réagit à l'application du plugin Android (`plugins.withId`) plutôt que de
 * passer par `afterEvaluate`. Le bloc est ajouté à la fin du `build.gradle`
 * racine, donc après `expo-root-project` et `com.facebook.react.rootproject`
 * qui évaluent déjà des sous-projets : à ce moment-là `afterEvaluate` lève
 * « Cannot run Project.afterEvaluate(Closure) when the project is already
 * evaluated ». `plugins.withId`, lui, se déclenche immédiatement si le plugin
 * est déjà appliqué, et plus tard sinon — les deux ordres fonctionnent.
 */
const MARKER = "with-android-lint-off";

const SNIPPET = `
// ${MARKER}
subprojects { subproject ->
  ["com.android.application", "com.android.library"].each { pluginId ->
    subproject.plugins.withId(pluginId) {
      subproject.android {
        lint {
          checkReleaseBuilds false
          abortOnError false
        }
      }
    }
  }
}
`;

module.exports = function withAndroidLintOff(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(`${MARKER} : build.gradle attendu en Groovy`);
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
