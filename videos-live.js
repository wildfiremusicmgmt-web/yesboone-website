/*
 * Yes Boone - keeps the Videos cards up to date.
 *
 * Asks /api/videos (a Cloudflare Pages Function) for the newest uploads and
 * points the site's existing video cards at them, newest first. It updates
 * the hidden Videos template as well as any cards already on screen, so the
 * Videos tab opens with the latest videos. Cards not needed for a new video
 * keep one of the videos already in the page (never duplicates). If anything
 * fails, the cards stay exactly as built into index.html.
 *
 * Include once, just before </body> in index.html:
 *   <script src="/videos-live.js" defer></script>
 */
(function () {
  if (window.__ybVideosLive) return;
  window.__ybVideosLive = true;

  var EMBED = /(youtube(?:-nocookie)?\.com\/embed\/)([\w-]{11})/;
  var VALID_ID = /^[\w-]{11}$/;
  var ATTRS = ['src', 'data-src'];
  var latest = null;

  function toArray(list) { return Array.prototype.slice.call(list || []); }

  function idOf(frame) {
    for (var i = 0; i < ATTRS.length; i++) {
      var match = (frame.getAttribute(ATTRS[i]) || '').match(EMBED);
      if (match) return match[2];
    }
    return '';
  }

  function youTubeFrames(root) {
    return toArray(root.querySelectorAll('iframe')).filter(idOf);
  }

  // Places to look: the page itself plus the hidden page templates.
  function roots() {
    var list = [document];
    toArray(document.querySelectorAll('template')).forEach(function (t) {
      if (t.content) list.push(t.content);
    });
    return list;
  }

  // Video lists to update. Uses the site's .video-feed boxes; if a future
  // version renames them, any box holding two or more YouTube embeds.
  // A single embed elsewhere on the site is never touched.
  function feeds() {
    var found = [];
    roots().forEach(function (root) {
      toArray(root.querySelectorAll('.video-feed')).forEach(function (box) {
        var frames = youTubeFrames(box);
        if (frames.length) found.push({ box: box, frames: frames });
      });
    });
    if (found.length) return found;
    roots().forEach(function (root) {
      var groups = [];
      youTubeFrames(root).forEach(function (frame) {
        var box = frame.parentNode;
        while (box && box !== root && youTubeFrames(box).length < 2) box = box.parentNode;
        if (!box || box === root) return;
        var group = groups.filter(function (g) { return g.box === box; })[0];
        if (!group) groups.push(group = { box: box, frames: [] });
        group.frames.push(frame);
      });
      groups.forEach(function (g) { if (g.frames.length > 1) found.push(g); });
    });
    return found;
  }

  // The card wrapping one video inside a list (if the site uses wrappers).
  function cardOf(frame, box) {
    var card = null;
    var node = frame.parentNode;
    while (node && node !== box && node.nodeType === 1 && youTubeFrames(node).length === 1) {
      card = node;
      node = node.parentNode;
    }
    return card;
  }

  function point(frame, video, box) {
    var oldId = idOf(frame);
    if (video.title) frame.setAttribute('title', video.title);
    if (oldId === video.id) return;
    ATTRS.forEach(function (attr) {
      var value = frame.getAttribute(attr);
      if (value && EMBED.test(value)) frame.setAttribute(attr, value.replace(EMBED, '$1' + video.id));
    });
    // Keep a "watch on YouTube" link in the same card in step with its video.
    var card = cardOf(frame, box);
    if (card) {
      toArray(card.querySelectorAll('a[href*="' + oldId + '"]')).forEach(function (link) {
        link.setAttribute('href', link.getAttribute('href').split(oldId).join(video.id));
      });
    }
  }

  function apply() {
    if (!latest) return;
    feeds().forEach(function (feed) {
      var used = {};
      var list = [];
      latest.forEach(function (video) {
        if (video && VALID_ID.test(video.id) && !used[video.id]) { used[video.id] = 1; list.push(video); }
      });
      feed.frames.forEach(function (frame) {
        var id = idOf(frame);
        if (!used[id]) { used[id] = 1; list.push({ id: id }); }
      });
      feed.frames.forEach(function (frame, i) { if (list[i]) point(frame, list[i], feed.box); });
    });
  }

  // The site redraws a page's content each time it opens; re-apply when it does.
  function watchForNewCards() {
    if (!window.MutationObserver || !document.body) return;
    var queued = false;
    new MutationObserver(function (changes) {
      var added = changes.some(function (change) {
        return toArray(change.addedNodes).some(function (node) {
          return node.nodeType === 1 &&
            (node.tagName === 'IFRAME' || (node.querySelector && node.querySelector('iframe')));
        });
      });
      if (added && !queued) {
        queued = true;
        setTimeout(function () { queued = false; apply(); }, 0);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    if (!window.fetch) return;
    fetch('/api/videos', { headers: { Accept: 'application/json' } })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        if (!data || !data.videos || !data.videos.length) return;
        latest = data.videos;
        apply();
        watchForNewCards();
      })
      .catch(function () { /* keep the videos already in the page */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
