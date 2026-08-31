/**
 * What a screen reader is given, on an app made of gestures.
 *
 * Everything here does one thing: turn a drag into two discrete actions. A
 * wallpaper is not something a blind user is going to judge, and pretending
 * otherwise would be its own kind of insult. What they can reasonably want is
 * to make one, for a sighted person or because the phone is theirs and the
 * cutout is real whether or not it is seen: pick an effect, set how far the
 * black reaches, save it. That is three controls, and all three are reachable
 * with this.
 *
 * `adjustable` is the role both platforms offer for exactly this. VoiceOver
 * announces the value and takes swipe up and swipe down; TalkBack does the same
 * with volume keys and its own gestures. Both arrive as these two actions.
 */
export const ADJUST = [{ name: "increment" }, { name: "decrement" }];

/** Which way an `adjustable` was pushed, as a step to add. */
export function adjustStep(actionName: string, step: number): number {
  return actionName === "increment" ? step : -step;
}
