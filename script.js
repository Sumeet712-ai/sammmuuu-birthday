(function () {
  'use strict';
  var landing = document.getElementById('landing');
  var giftBox = document.getElementById('giftBox');
  var memoryLane = document.getElementById('memoryLane');
  var confettiCanvas = document.getElementById('confettiCanvas');
  var bgParticles = document.getElementById('bgParticles');
  var ctx = confettiCanvas.getContext('2d');
  var confettiPieces = [], confettiRunning = false;

  // ═══════════════════════════════════════════
  // PHOTO CARD GENERATION
  // ═══════════════════════════════════════════
  var gradients = [
    ['#2d0a3e','#c084fc','#ff6b9d'], ['#0a2a3d','#0984e3','#74b9ff'],
    ['#3d1a0a','#e67e22','#fbbf24'], ['#0a3d2a','#00b894','#55efc4'],
    ['#3d0a1a','#d63031','#fdcb6e'], ['#1a0a3d','#6c3483','#a29bfe'],
    ['#2a3d0a','#6ab04c','#badc58'], ['#3d0e3d','#8e44ad','#fd79a8'],
    ['#0e2a3d','#2980b9','#1abc9c'], ['#3d2a0a','#f39c12','#e74c3c']
  ];
  var emojiPool = ['📸','✨','💃','🎶','🔥','💜','🌟','🎊','🩷','🪩','😂','🎭','🤪','🎉','❤️','💕','🥰','💖','🫶','💗','🗺️','✈️','🏔️','🍕','🍔','🍦','☕','🧺','💛','🌈'];

  var cacheBuster = Date.now(); // Force fresh image loads

  function generatePhotoCards() {
    var sections = document.querySelectorAll('.memory-section');
    sections.forEach(function(section) {
      var folder = section.dataset.folder;
      var count = parseInt(section.dataset.count) || 0;
      var direction = section.dataset.direction || 'left';
      var gallery = section.querySelector('.memory-section__gallery');
      if (!gallery || count === 0) return;

      for (var i = 0; i < count; i++) {
        var card = document.createElement('div');
        // Alternate directions: even index comes from left, odd comes from right
        var cardDir = (i % 2 === 0) ? 'left' : 'right';
        card.className = 'photo-card photo-card--offscreen-' + cardDir;
        var imgSrc = 'assets/' + folder + '/' + (i + 1) + '.jpg?v=' + cacheBuster;
        card.style.setProperty('--bg-img', "url('" + imgSrc + "')");
        card.dataset.index = i;
        card.dataset.direction = cardDir;
        card.dataset.src = imgSrc;

        var g = gradients[i % gradients.length];
        var emoji = emojiPool[i % emojiPool.length];
        card.innerHTML = '<img class="photo-card__img" src="' + imgSrc + '" alt="Memory ' + (i+1) + '" loading="lazy" />' +
          '<div class="photo-card__placeholder" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ',' + g[2] + ')"><span class="p-emoji">' + emoji + '</span><span class="p-num">' + (i + 1) + '</span></div>';

        gallery.appendChild(card);
      }

      // Check which images exist
      checkSectionImages(gallery);
    });
  }

  function checkSectionImages(gallery) {
    var cards = gallery.querySelectorAll('.photo-card');
    cards.forEach(function(card) {
      var imgEl = card.querySelector('.photo-card__img');
      if (imgEl) {
        var hidePlace = function() {
          var p = card.querySelector('.photo-card__placeholder');
          if (p) {
            p.style.transition = 'opacity 0.6s ease';
            p.style.opacity = '0';
            setTimeout(function(){ p.style.display = 'none'; }, 600);
          }
        };
        if (imgEl.complete && imgEl.naturalWidth > 0) {
          hidePlace();
        } else {
          imgEl.onload = hidePlace;
          imgEl.onerror = function() { imgEl.style.display = 'none'; };
        }
      }
    });
  }

  // ═══════════════════════════════════════════
  // SCROLL-DRIVEN CARD STACKING
  // Each scroll "tick" reveals one card.
  // Cards fly in and stack on the RIGHT side.
  // After all cards stack → slide to center as a fan.
  // ═══════════════════════════════════════════
  var sectionStates = [];

  function initScrollCardStack() {
    var sections = document.querySelectorAll('.memory-section');
    var viewH = window.innerHeight;
    var isMobile = window.innerWidth <= 900;

    sections.forEach(function(section) {
      var gallery = section.querySelector('.memory-section__gallery');
      var headerEl = section.querySelector('.memory-section__header');
      var cards = Array.from(gallery.querySelectorAll('.photo-card'));
      if (!cards.length) return;

      var totalCards = cards.length;

      // ── Uniform scroll pace: 300px per card ──
      var scrollPerCard = 300;

      var headerHeight = isMobile ? headerEl.offsetHeight : 0;
      var totalScrollForCards = totalCards * scrollPerCard;

      var needsFan = totalCards > 1;
      var fanBuffer = 500; // buffer after last card before section ends
      var totalScrollNeeded = viewH + headerHeight + totalScrollForCards + fanBuffer;

      section.style.minHeight = totalScrollNeeded + 'px';
      section.style.position = 'relative';

      // ── CRITICAL FIX: Move gallery to <body> so that the parent
      //    .reveal's transform (translateY) never breaks position:fixed.
      //    CSS spec: any ancestor with transform makes position:fixed
      //    relative to that ancestor, not the viewport. ──
      document.body.appendChild(gallery);

      sectionStates.push({
        section: section,
        gallery: gallery,
        headerEl: headerEl,
        cards: cards,
        totalCards: totalCards,
        scrollPerCard: scrollPerCard,
        totalScrollForCards: totalScrollForCards,
        headerHeight: headerHeight,
        needsFan: needsFan,
        isFanned: false,
        isFixed: false
      });
    });

    window.addEventListener('scroll', onScrollUpdate, { passive: true });
    onScrollUpdate();
  }

  function onScrollUpdate() {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var viewH = window.innerHeight;
    var isMobile = window.innerWidth <= 900;

    // Track which section is most "in view" so only ONE gallery shows at a time
    var bestIdx = -1;
    var bestScore = -Infinity;

    sectionStates.forEach(function(state, idx) {
      var rect = state.section.getBoundingClientRect();
      // Score: how centered the section is (higher = more visible)
      var visibleTop = Math.max(rect.top, 0);
      var visibleBot = Math.min(rect.bottom, viewH);
      var visiblePx = visibleBot - visibleTop;
      if (visiblePx > bestScore) {
        bestScore = visiblePx;
        bestIdx = idx;
      }
    });

    sectionStates.forEach(function(state, idx) {
      var rect = state.section.getBoundingClientRect();
      var isActive = (idx === bestIdx) && bestScore > 0;

      // How far we've scrolled into this section (0 = just entered)
      var sectionTop = rect.top + scrollY;
      var headerOffset = isMobile ? state.headerHeight : 0;
      var scrollInSection = scrollY - sectionTop - headerOffset + viewH * 0.5;
      if (scrollInSection < 0) scrollInSection = 0;

      // ── Toggle gallery visibility ──
      if (isActive && !state.isFixed) {
        state.gallery.classList.add('gallery--fixed');
        if (!isMobile) state.gallery.style.left = '70%';
        state.isFixed = true;
      } else if (!isActive && state.isFixed) {
        state.gallery.classList.remove('gallery--fixed');
        state.gallery.style.left = '';
        state.isFixed = false;
      }

      // ── Reveal cards one by one ──
      var cardsToReveal = Math.floor(scrollInSection / state.scrollPerCard);
      if (cardsToReveal > state.totalCards) cardsToReveal = state.totalCards;
      if (cardsToReveal < 0) cardsToReveal = 0;

      for (var i = 0; i < state.totalCards; i++) {
        var card = state.cards[i];
        if (i < cardsToReveal) {
          if (!card.classList.contains('photo-card--stacked')) {
            card.classList.remove('photo-card--offscreen-left', 'photo-card--offscreen-right');
            card.classList.add('photo-card--stacked');

            var stackX = (Math.random() - 0.5) * 15;
            var stackY = -i * 3 + (Math.random() - 0.5) * 10;
            var angle = (Math.random() - 0.5) * 6;

            card.style.transform = 'translate(' + stackX + 'px, ' + stackY + 'px) rotate(' + angle + 'deg)';
            card.style.zIndex = i + 10;
            card.style.opacity = '1';
          }
        } else {
          if (card.classList.contains('photo-card--stacked')) {
            card.classList.remove('photo-card--stacked');
            var dir = card.dataset.direction || 'left';
            card.classList.add('photo-card--offscreen-' + dir);
            card.style.opacity = '0';
          }
        }
      }

      // ── Fan out after all cards revealed ──
      if (state.needsFan) {
        var fanThreshold = state.totalScrollForCards + 200;
        if (scrollInSection >= fanThreshold && cardsToReveal >= state.totalCards && !state.isFanned) {
          state.isFanned = true;
          fanOutCards(state.cards);
        }
        if (scrollInSection < fanThreshold && state.isFanned) {
          state.isFanned = false;
          state.cards.forEach(function(card, i) {
            if (card.classList.contains('photo-card--stacked')) {
              var stackX = (Math.random() - 0.5) * 15;
              var stackY = -i * 3 + (Math.random() - 0.5) * 10;
              var angle = (Math.random() - 0.5) * 6;
              card.style.transition = 'transform 0.6s var(--ease-out-expo)';
              card.style.transform = 'translate(' + stackX + 'px, ' + stackY + 'px) rotate(' + angle + 'deg)';
            }
          });
        }
      }
    });
  }

  function fanOutCards(cards) {
    var totalCards = cards.length;
    // Scale fan spread based on card count
    var fanAngleRange = totalCards <= 5
      ? Math.min(totalCards * 8, 40)   // Wide spread for few cards
      : Math.min(totalCards * 3, 60);  // Tighter per-card for many cards
    var startAngle = -fanAngleRange / 2;

    cards.forEach(function(card, i) {
      var progress = totalCards > 1 ? i / (totalCards - 1) : 0.5;
      var angle = startAngle + progress * fanAngleRange;
      // Scale offsets so large fans don't overflow the screen
      var spreadFactor = totalCards <= 10 ? 3.5 : 2;
      var offsetX = angle * spreadFactor;
      var offsetY = Math.abs(angle) * (totalCards <= 10 ? 1.2 : 0.6);

      card.style.transition = 'transform 0.8s var(--ease-out-expo)';
      card.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) rotate(' + angle + 'deg)';
      card.style.zIndex = 50 - Math.abs(Math.round(angle));
      card.classList.add('photo-card--fanned');
    });
  }

  // ═══════════════════════════════════════════
  // PHOTO LIGHTBOX
  // ═══════════════════════════════════════════
  var lightboxCurrentCards = [];
  var lightboxCurrentIndex = 0;

  function initLightbox() {
    var lightbox = document.getElementById('photoLightbox');
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxClose = document.getElementById('lightboxClose');
    var lightboxPrev = document.getElementById('lightboxPrev');
    var lightboxNext = document.getElementById('lightboxNext');
    var lightboxCounter = document.getElementById('lightboxCounter');
    if (!lightbox) return;

    function getCardImageSrc(card) {
      // Prefer data-src attribute
      if (card.dataset.src) return card.dataset.src;
      var bg = card.style.getPropertyValue('--bg-img');
      if (bg) {
        var match = bg.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1]) return match[1];
      }
      return '';
    }

    function openLightbox(cards, index) {
      lightboxCurrentCards = cards;
      lightboxCurrentIndex = index;
      var src = getCardImageSrc(cards[index]);
      if (!src) return;
      lightboxImg.src = src;
      lightboxCounter.textContent = (index + 1) + ' / ' + cards.length;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      setTimeout(function() { lightboxImg.src = ''; }, 400);
    }

    function navigateLightbox(dir) {
      var newIndex = lightboxCurrentIndex + dir;
      if (newIndex < 0) newIndex = lightboxCurrentCards.length - 1;
      if (newIndex >= lightboxCurrentCards.length) newIndex = 0;
      lightboxCurrentIndex = newIndex;
      var src = getCardImageSrc(lightboxCurrentCards[newIndex]);
      if (src) {
        lightboxImg.style.opacity = '0';
        setTimeout(function() {
          lightboxImg.src = src;
          lightboxImg.style.opacity = '1';
          lightboxCounter.textContent = (newIndex + 1) + ' / ' + lightboxCurrentCards.length;
        }, 150);
      }
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', function() { navigateLightbox(-1); });
    lightboxNext.addEventListener('click', function() { navigateLightbox(1); });

    // Close on backdrop click
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox) closeLightbox();
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    });

    // Attach click handlers to all photo cards
    document.addEventListener('click', function(e) {
      var card = e.target.closest('.photo-card');
      if (!card) return;
      // Find the parent gallery and all its cards
      var gallery = card.closest('.memory-section__gallery');
      if (!gallery) return;
      var allCards = Array.from(gallery.querySelectorAll('.photo-card'));
      var idx = allCards.indexOf(card);
      if (idx >= 0) openLightbox(allCards, idx);
    });
  }

  // ═══════════════════════════════════════════
  // PARTICLES
  // ═══════════════════════════════════════════
  function createParticles(n) {
    for (var i = 0; i < n; i++) {
      var p = document.createElement('div');
      p.classList.add('particle');
      p.style.left = Math.random() * 100 + '%';
      p.style.top = (60 + Math.random() * 40) + '%';
      p.style.animationDelay = Math.random() * 6 + 's';
      p.style.animationDuration = 4 + Math.random() * 4 + 's';
      var hue = [340,280,30,210][Math.floor(Math.random()*4)];
      p.style.background = 'hsl('+hue+',70%,70%)';
      var s = 2+Math.random()*4+'px'; p.style.width=s; p.style.height=s;
      bgParticles.appendChild(p);
    }
  }

  // ═══════════════════════════════════════════
  // CONFETTI
  // ═══════════════════════════════════════════
  function resizeCanvas(){confettiCanvas.width=window.innerWidth;confettiCanvas.height=window.innerHeight}
  var cC=['#e8a0bf','#b8a9e8','#d4a76a','#f0c2a0','#ff6b9d','#c084fc','#fbbf24','#f472b6'];
  function newP(){return{x:Math.random()*confettiCanvas.width,y:-20,w:8+Math.random()*8,h:6+Math.random()*4,color:cC[Math.floor(Math.random()*cC.length)],vx:(Math.random()-.5)*6,vy:2+Math.random()*4,angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*.2,opacity:1,decay:.003+Math.random()*.003}}
  function fireConfetti(){
    confettiCanvas.classList.add('active');confettiRunning=true;
    for(var i=0;i<180;i++){var p=newP();p.x=confettiCanvas.width/2+(Math.random()-.5)*200;p.y=confettiCanvas.height/2;p.vx=(Math.random()-.5)*16;p.vy=-8-Math.random()*10;confettiPieces.push(p)}
    var c=0,t=setInterval(function(){for(var j=0;j<4;j++)confettiPieces.push(newP());if(++c>50)clearInterval(t)},100);
    drawC();
  }
  function drawC(){
    if(!confettiRunning)return;ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
    confettiPieces=confettiPieces.filter(function(p){return p.opacity>.01});
    if(!confettiPieces.length){confettiRunning=false;confettiCanvas.classList.remove('active');return}
    for(var i=0;i<confettiPieces.length;i++){var p=confettiPieces[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.vx*=.99;p.angle+=p.spin;p.opacity-=p.decay;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.globalAlpha=p.opacity;ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore()}
    requestAnimationFrame(drawC);
  }

  // ═══════════════════════════════════════════
  // GIFT BOX - CYLINDRICAL SPIN → LID OPEN → CONFETTI
  // ═══════════════════════════════════════════
  function createSparkles() {
    var container = document.getElementById('giftSparkles');
    if (!container) return;
    var colors = ['#f1c40f','#e8a0bf','#b8a9e8','#ff6b9d','#fbbf24','#fff'];
    for (var i = 0; i < 30; i++) {
      var s = document.createElement('div');
      s.className = 'sparkle';
      s.style.left = (Math.random() * 160 + 10) + 'px';
      s.style.top = Math.random() * 20 + 'px';
      s.style.background = colors[Math.floor(Math.random() * colors.length)];
      s.style.setProperty('--sx', (Math.random() - 0.5) * 300 + 'px');
      s.style.setProperty('--sy', -(Math.random() * 200 + 80) + 'px');
      s.style.width = (3 + Math.random() * 5) + 'px';
      s.style.height = s.style.width;
      s.style.animation = 'sparkleOut ' + (0.6 + Math.random() * 0.8) + 's ease-out ' + (Math.random() * 0.3) + 's forwards';
      container.appendChild(s);
    }
  }

  function handleGiftClick() {
    var boxInner = document.getElementById('giftBoxInner');
    var lid = document.getElementById('giftLid');
    giftBox.style.pointerEvents = 'none';

    // Phase 1: Cylindrical spin (rotateY × 3 turns, 2 seconds)
    boxInner.classList.add('spinning');

    // Phase 2: After spin completes, lid opens + sparkles burst
    setTimeout(function() {
      boxInner.classList.remove('spinning');
      boxInner.style.transform = 'rotateY(1080deg)';
      lid.classList.add('open');
      createSparkles();
      fireConfetti();
    }, 2000);

    // Phase 3: Second confetti burst
    setTimeout(fireConfetti, 2800);

    // Phase 4: Box vanishes
    setTimeout(function() {
      boxInner.classList.add('vanishing');
    }, 3200);

    // Phase 5: Transition to main page
    setTimeout(function() {
      landing.classList.add('hidden');
      memoryLane.classList.add('visible');
      setTimeout(function() {
        initScrollReveal();
        initScrollCardStack();
      }, 500);
    }, 3800);

    setTimeout(function() {
      landing.style.display = 'none';
    }, 5000);
  }

  // ═══════════════════════════════════════════
  // SCROLL REVEAL
  // ═══════════════════════════════════════════
  function initScrollReveal() {
    var els = document.querySelectorAll('.reveal');
    var cards = document.querySelectorAll('.compliment-card');
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -60px 0px' });
    els.forEach(function(el) { obs.observe(el); });

    var cObs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          var g = e.target.closest('.compliments__grid');
          if (g) {
            g.querySelectorAll('.compliment-card').forEach(function(c, i) {
              setTimeout(function() { c.classList.add('visible'); }, i * 150);
            });
          }
          cObs.unobserve(e.target);
        }
      });
    }, { threshold: .1 });
    if (cards.length) cObs.observe(cards[0]);
  }

  // ═══════════════════════════════════════════
  // SEAL
  // ═══════════════════════════════════════════
  function initSeal() {
    var seal = document.getElementById('seal');
    var msgCard = document.getElementById('secretMsgCard');
    if (!seal) return;
    var open = false;
    seal.addEventListener('click', function() {
      open = !open;
      seal.querySelector('.finale__seal-front').style.transform = open ? 'rotateY(180deg)' : 'rotateY(0)';
      seal.querySelector('.finale__seal-back').style.transform = open ? 'rotateY(0)' : 'rotateY(180deg)';
      if (msgCard) {
        if (open) {
          msgCard.classList.add('visible');
        } else {
          msgCard.classList.remove('visible');
        }
      }
    });
  }

  // ═══════════════════════════════════════════
  // INTERACTIVE CAKE - SHAKE + BLOW
  // ═══════════════════════════════════════════
  function initCake() {
    var btn = document.getElementById('blowBtn');
    var flame = document.getElementById('flame');
    var title = document.getElementById('finaleTitle');
    var surprise = document.getElementById('finaleSurprise');
    if (!btn || !flame) return;

    btn.addEventListener('click', function() {
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.5';

      // Phase 1: Flame shakes violently
      flame.classList.add('shaking');

      // Phase 2: Hide button
      setTimeout(function() {
        btn.classList.add('hidden');
        title.style.opacity = '0';
      }, 1200);

      // Phase 3: Title changes
      setTimeout(function() {
        title.textContent = 'Wish Granted! ✨';
        title.style.opacity = '1';
      }, 1800);

      // Phase 4: Reveal surprise with confetti
      setTimeout(function() {
        surprise.classList.add('visible');
        confettiCanvas.style.zIndex = '9999';
        fireConfetti();
      }, 2300);
    });
  }

  // ═══════════════════════════════════════════
  // FLOATING JOKES
  // ═══════════════════════════════════════════
  function startFloatingJokes() {
    var jokes = ['3 AM Gossips', 'Always Hungry', 'Matching Outfits', 'Secret Keepers', 'Endless Laughter', '"Kya khayein?"', 'Partner in Crime', 'Unstoppable Duo', 'Vibe Match', 'Soul Sisters'];
    var container = document.getElementById('floatingJokes');
    if (!container) return;
    setInterval(function() {
      if (landing.style.display !== 'none') return;
      var el = document.createElement('div');
      el.className = 'joke-word';
      el.textContent = jokes[Math.floor(Math.random() * jokes.length)];
      el.style.left = (Math.random() * 80 + 10) + '%';
      el.style.fontSize = (Math.random() * 2 + 1.5) + 'rem';
      container.appendChild(el);
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 15000);
    }, 2500);
  }

  // ═══════════════════════════════════════════
  // LIVE EMOJI ANIMATIONS
  // ═══════════════════════════════════════════
  function initLiveEmojis() {
    var emojiEls = document.querySelectorAll('.compliment-card__emoji');
    emojiEls.forEach(function(el) {
      el.addEventListener('mouseenter', function() {
        el.style.animation = 'none';
        void el.offsetWidth;
        var animations = [
          'emojiLive 0.4s ease-in-out 3',
          'emojiBounce 0.5s ease-in-out 2',
          'emojiSpin 0.6s ease-in-out 1'
        ];
        el.style.animation = animations[Math.floor(Math.random() * animations.length)];
      });
    });

    var style = document.createElement('style');
    style.textContent = '@keyframes emojiBounce{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.3) translateY(-15px)}}@keyframes emojiSpin{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.3)}100%{transform:rotate(360deg) scale(1)}}';
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════
  function init() {
    generatePhotoCards();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    createParticles(40);
    giftBox.addEventListener('click', handleGiftClick);
    initSeal();
    startFloatingJokes();
    initCake();
    initLiveEmojis();
    initLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
