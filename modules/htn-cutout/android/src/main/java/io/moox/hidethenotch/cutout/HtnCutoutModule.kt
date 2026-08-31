package io.moox.hidethenotch.cutout

import android.os.Build
import android.view.DisplayCutout
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The one thing Android knows about the hole and will not tell React Native.
 *
 * `react-native-safe-area-context` reports insets, and an inset is a single
 * number: the top one is asked for as `statusBars | displayCutout |
 * navigationBars`, so it is the larger of the status bar and the hole with no
 * way to tell which won, let alone where across the width the hole sits. That
 * is enough to keep a mask safe, and not enough to draw the phone the user is
 * holding: a punch hole two thirds of the way to the left is a different
 * picture from a centred one.
 *
 * `DisplayCutout.getBoundingRectTop()` is the real rectangle, in display
 * pixels, and it is one call away as soon as there is native code to make it.
 * This module is that call and nothing else. It returns pixels and the density
 * rather than points, so the conversion happens in one place on the JavaScript
 * side, next to everything else that is measured in points.
 *
 * Android only. iOS never exposes the sensor housing at all, so there it is a
 * table of models (see `src/geometry/models.ts`).
 */
class HtnCutoutModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HtnCutout")

    // On the main queue, because the answer comes off a view. `rootWindowInsets`
    // is view state, and view state is read on the thread that owns it.
    //
    // Every number is a Double, including the ones Android hands over as Int:
    // one type across the map is one converter on the way to JavaScript, and
    // pixels stop being whole numbers the moment they are divided by a density
    // anyway.
    AsyncFunction("getCutout") {
      val density = appContext.reactContext?.resources?.displayMetrics?.density?.toDouble()
      val cutout = displayCutout()
      val rect = cutout?.boundingRectTop

      if (density == null || cutout == null || rect == null || rect.isEmpty) {
        return@AsyncFunction null
      }

      mapOf(
        "x" to rect.left.toDouble(),
        "y" to rect.top.toDouble(),
        "w" to rect.width().toDouble(),
        "h" to rect.height().toDouble(),
        // The system's own answer for how far down the hole reaches, kept
        // alongside the rectangle so the two can be checked against each other.
        "safeInsetTop" to cutout.safeInsetTop.toDouble(),
        "density" to density,
      )
    }.runOnQueue(Queues.MAIN)
  }

  /**
   * The cutout, from the window if the view hierarchy has one yet.
   *
   * Insets reach a decor view only once it is attached, and this can be called
   * before that. `currentWindowMetrics` answers the same question without a
   * view, so it is the fallback rather than the other way round: it describes
   * the window the activity would get, while `rootWindowInsets` describes the
   * one it has.
   */
  private fun displayCutout(): DisplayCutout? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return null
    }
    val activity = appContext.currentActivity ?: return null

    activity.window?.decorView?.rootWindowInsets?.displayCutout?.let {
      return it
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      return activity.windowManager.currentWindowMetrics.windowInsets.displayCutout
    }
    return null
  }
}
