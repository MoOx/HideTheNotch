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
 */
const MARKER = "with-android-lint-off";

const SNIPPET = `
// ${MARKER}
subprojects { subproject ->
  subproject.afterEvaluate {
    if (subproject.hasProperty("android")) {
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
