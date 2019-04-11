/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// These tests are for testing Shaka Player's integration with
// |HTMLMediaElement.src=|. These tests are to verify that all |shaka.Player|
// public methods behaviour correctly when playing content video |src=|.
describe('Player Src Equals', () => {
  const SMALL_MP4_CONTENT_URI = '/base/test/test/assets/small.mp4';

  /** @type {!HTMLVideoElement} */
  let video;
  /** @type {!shaka.Player} */
  let player;

  beforeAll(() => {
    video = shaka.util.Dom.createVideoElement();
    document.body.appendChild(video);
  });

  beforeEach(() => {
    player = new shaka.Player();
    player.addEventListener('error', fail);
  });

  afterEach(async () => {
    await player.destroy();

    // Work-around: allow the Tizen media pipeline to cool down.
    // Without this, Tizen's pipeline seems to hang in subsequent tests.
    // TODO: file a bug on Tizen
    await shaka.test.Util.delay(0.1);
  });

  afterAll(() => {
    document.body.removeChild(video);
  });

  // This test verifies that we can successfully load content that requires us
  // to use |src=|.
  it('loads content', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
  });

  // This test verifys that we can successfully unload content that required
  // |src=| to load.
  it('unloads content', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    await player.unload(/* initMediaSource= */ false);
  });

  it('can get asset uri after loading', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    expect(player.getAssetUri()).toBe(SMALL_MP4_CONTENT_URI);
  });

  // Since we don't have any manifest data, we must assume that all content is
  // VOD; |isLive| and |isInProgress| should always return |false|.
  it('considers content to be VOD"', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    expect(player.isLive()).toBeFalsy();
    expect(player.isInProgress()).toBeFalsy();
  });

  // Since we don't have any manifest data, we must assume that all content is
  // audio-video; |isAudioOnly| should always return |false|.
  it('considers content to be audio-video', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    expect(player.isAudioOnly()).toBeFalsy();
  });

  // Since we don't have any manifest data, we must assume that we can seek
  // anywhere in the presentation; end-time will come from the media element.
  it('allows seeking throughout the presentation', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    // The seek range should match the duration of the content.
    const seekRange = player.seekRange();
    expect(seekRange.start).toBeCloseTo(0);
    expect(seekRange.end).toBeCloseTo(video.duration);
    expect(video.duration).not.toBeCloseTo(0);

    // Start playback and let it play for a little. We give it a couple second
    // so that any start-up latency from the media stack will be forgiven.
    video.play();
    await shaka.test.Util.delay(2);

    // Make sure the playhead is roughly where we expect it to be before
    // seeking.
    expect(video.currentTime).toBeGreaterThan(0);
    expect(video.currentTime).toBeLessThan(2.0);

    // Trigger a seek and then wait a little to allow the seek to take effect.
    video.currentTime = 10;
    await shaka.test.Util.delay(0.5);

    // Make sure the playhead is roughly where we expect it to be after
    // seeking.
    expect(video.currentTime).toBeGreaterThan(9.5);
    expect(video.currentTime).toBeLessThan(10.5);
  });

  // Since we don't have any manifest data, we assume content to be clear.
  // This means there should be no key systems, drm info, or expiration time.
  it('considers content to be clear ', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    expect(player.keySystem()).toBe('');
    expect(player.drmInfo()).toBe(null);
    expect(player.getExpiration()).toBe(Infinity);
  });

  // Compared to media source, when loading content with src=, we will have less
  // accurate information. However we can still report what the media element
  // surfaces.
  it('reports buffering information', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    // Wait one second in hopes that it will allow us to buffer more than one
    // second of content.
    await shaka.test.Util.delay(1);

    const buffered = player.getBufferedInfo();

    // We don't have per-stream insights.
    expect(buffered.audio).toEqual([]);
    expect(buffered.video).toEqual([]);
    expect(buffered.text).toEqual([]);

    // We should have an overall view of buffering. We gave ourselves a second
    // to buffer content, so we should have more than one second worth of
    // content (hopefully).
    expect(buffered.total).toBeTruthy();
    expect(buffered.total.length).toBe(1);
    expect(buffered.total[0].start).toBeCloseTo(0);
    expect(buffered.total[0].end).toBeGreaterThan(1);
  });

  // When we load content via src=, can we use the trick play controls to
  // control the playback rate?
  it('can control trick play rate', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    video.play();

    // Let playback run for a little.
    await shaka.test.Util.delay(0.1);

    // Enabling trick play should change our playback rate to the same rate.
    player.trickPlay(2);
    expect(video.playbackRate).toBe(2);

    // Let playback continue playing for a bit longer.
    await shaka.test.Util.delay(0.5);

    // Cancelling trick play should return our playback rate to normal.
    player.cancelTrickPlay();
    expect(video.playbackRate).toBe(1);
  });

  // Since we don't have a manifest, we can't report what tracks(s) we are
  // playing.
  it('reports no variant tracks after loading', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    expect(player.getVariantTracks()).toEqual([]);
  });

  // Since we are not in-charge of managing variant tracks, we can't select
  // tracks.
  it('cannot select variant tracks', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    /**
     * Because we can't get tracks from the player, we need to create a fake
     * track to ask it to switch to. The player should just ignore this request.
     *
     * @type {shaka.extern.Track}
     * */
    const track = {
      active: true,
      audioBandwidth: null,
      audioCodec: null,
      audioId: null,
      bandwidth: 123456789,
      channelsCount: null,
      codecs: null,
      frameRate: null,
      height: null,
      id: 0,
      kind: null,
      label: null,
      language: 'en-US',
      mimeType: 'text/mp4',
      originalAudioId: null,
      originalTextId: null,
      originalVideoId: null,
      primary: true,
      roles: [],
      type: 'text',
      videoBandwidth: null,
      videoCodec: null,
      videoId: null,
      width: null,
    };

    // This call should be a no-op. WE expect to see no errors throws.
    player.selectVariantTrack(track);
  });

  // Since we don't have a manifest, we can't report what tracks(s) we are
  // playing.
  it('reports no text tracks', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    expect(player.getTextTracks()).toEqual([]);
  });

  // Since we don't have a manifest, we can't report what tracks(s) we are
  // playing. Even though we can add additional text tracks, since we don't
  // initialize any streaming systems, we can't select text tracks.
  it('cannot select text tracks', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    /**
     * Because we can't get tracks from the player, we need to create a fake
     * track to ask it to switch to. The player should just ignore this request.
     *
     * @type {shaka.extern.Track}
     * */
    const track = {
      active: true,
      audioBandwidth: null,
      audioCodec: null,
      audioId: null,
      bandwidth: 123456789,
      channelsCount: null,
      codecs: null,
      frameRate: null,
      height: null,
      id: 0,
      kind: null,
      label: null,
      language: 'en-US',
      mimeType: 'text/mp4',
      originalAudioId: null,
      originalTextId: null,
      originalVideoId: null,
      primary: true,
      roles: [],
      type: 'text',
      videoBandwidth: null,
      videoCodec: null,
      videoId: null,
      width: null,
    };

    // This call should be a no-op. WE expect to see no errors throws.
    player.selectTextTrack(track);
  });

  // Since we are not managing the tracks, we can't return any language/role
  // for audio or text.
  it('returns no languages or roles', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    expect(player.getAudioLanguages()).toEqual([]);
    expect(player.getAudioLanguagesAndRoles()).toEqual([]);

    expect(player.getTextLanguages()).toEqual([]);
    expect(player.getTextLanguagesAndRoles()).toEqual([]);
  });

  // Since we are not managing the tracks, selecting the language/role or audio
  // or text should do nothing.
  it('cannot select language or role', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    const language = 'en';
    const role = 'main';

    player.selectAudioLanguage(language);
    expect(player.getAudioLanguages()).toEqual([]);
    expect(player.getAudioLanguagesAndRoles()).toEqual([]);

    player.selectAudioLanguage(language, role);
    expect(player.getAudioLanguages()).toEqual([]);
    expect(player.getAudioLanguagesAndRoles()).toEqual([]);

    player.selectTextLanguage(language);
    expect(player.getTextLanguages()).toEqual([]);
    expect(player.getTextLanguagesAndRoles()).toEqual([]);

    player.selectTextLanguage(language, role);
    expect(player.getTextLanguages()).toEqual([]);
    expect(player.getTextLanguagesAndRoles()).toEqual([]);
  });

  // Since we are not managing the tracks, we can't control whether or not we
  // are showing text. Trying to show the tracks should do nothing.
  it('never shows text', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    expect(player.isTextTrackVisible()).toBeFalsy();
    player.setTextTrackVisibility(true);
    expect(player.isTextTrackVisible()).toBeFalsy();
  });

  // Even though we loaded content using |src=| we should still be able to get
  // the playhead position as normal.
  it('can get the playhead position', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    expect(video.readyState).toBeGreaterThan(0);

    expect(video.currentTime).toBeCloseTo(0);

    // Start playback and wait. We should see the playhead move.
    video.play();
    await shaka.test.Util.delay(1.5);

    // When checking if the playhead moved, check for less progress than time we
    // delayed. This will allow for some latency between |play| and playback
    // starting.
    expect(video.currentTime).toBeGreaterThan(1);
  });

  // Even though we are not using all the internals, we should still get some
  // meaningful statistics.
  it('can get stats', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    // Wait some time for playback to start so that we will have a load latency
    // value.
    await shaka.test.Util.delay(0.2);

    // Get the stats and check that some stats have been filled in.
    const stats = player.getStats();
    expect(stats).toBeTruthy();
    expect(stats.loadLatency).toBeGreaterThan(0);
  });

  // Because we have no manifest, we can't add text tracks.
  it('cannot add text tracks', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);

    const pendingAdd = player.addTextTrack(
        'test:need-a-uri-for-text',
        'en-US',
        'main',
        'text/mp4');

    try {
      await pendingAdd;
      fail();
    } catch (e) {
      // The player only rejects the promise, but does not provide an error.
      expect(e).toBeFalsy();
    }
  });

  // Since we are not in-charge of streaming, calling |retryStreaming| should
  // have no effect.
  it('requesting streaming retry does nothing', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    expect(player.retryStreaming()).toBeFalsy();
  });

  // Since we are not loading a manifest, we can't return a manifest.
  // |getManifest| should return |null|.
  it('has no manifest to return', async () => {
    await loadWithSrcEquals(SMALL_MP4_CONTENT_URI);
    expect(player.getManifest()).toBeFalsy();
  });

  /**
   * @param {string} contentUri
   * @return {!Promise}
   */
  async function loadWithSrcEquals(contentUri) {
    /** @type {!shaka.util.EventManager} */
    const eventManager = new shaka.util.EventManager();

    const ready = new Promise((resolve) => {
      eventManager.listenOnce(video, 'loadedmetadata', resolve);
    });

    await player.attach(video, /* initMediaSource= */ false);
    await player.load(contentUri);

    // Wait until the media element is ready with content. Waiting until this
    // point ensures it is safe to interact with the media element.
    await ready;

    eventManager.release();
  }
});