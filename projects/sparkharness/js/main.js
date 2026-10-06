/* ==========================================================================
   破晓 Spark Harness — 官网脚本
   动效策略与应用源码保持一致：
     · 需要「中途可打断」的位移/透明度 —— 用 requestAnimationFrame 逐帧插值，
       缓动为非线性贝塞尔（对应应用里的 lib/slide.ts / lib/capsule.ts）；
     · 不被打断的静态过渡 —— 交给 CSS 的 --ease-* 令牌。
   无任何外部依赖，无网络请求。
   ========================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = false; // 由「界面动效」档位决定，运行时可变

  /* ---------- 缓动函数：与 CSS cubic-bezier 等价的三次贝塞尔求值 ---------- */
  function bezier(x1, y1, x2, y2) {
    function A(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
    function B(a1, a2) { return 3 * a2 - 6 * a1; }
    function C(a1) { return 3 * a1; }
    function calc(t, a1, a2) { return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t; }
    function slope(t, a1, a2) { return 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 6; i++) {
        var d = slope(t, x1, x2);
        if (d === 0) break;
        var err = calc(t, x1, x2) - x;
        if (Math.abs(err) < 1e-5) break;
        t -= err / d;
      }
      return calc(t, y1, y2);
    };
  }

  // 与应用令牌同源：--ease-enter / --ease-spring / --ease-standard
  var EASE_ENTER = bezier(0.22, 1, 0.36, 1);
  var EASE_SPRING = bezier(0.34, 1.4, 0.44, 1);
  var EASE_STANDARD = bezier(0.4, 0, 0.2, 1);

  /* ---------- 选择器小工具 ---------- */
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- 通用逐帧补间 ---------- */
  function tween(opts) {
    var from = opts.from;
    var to = opts.to;
    var ease = opts.ease || EASE_STANDARD;
    var dur = opts.duration || 400;
    var onUpdate = opts.onUpdate;
    var onDone = opts.onDone;
    var start = 0;
    var raf = 0;

    if (reduceMotion || dur <= 0) {
      onUpdate(to, 1);
      if (onDone) onDone();
      return function () {};
    }

    function step(now) {
      if (!start) start = now;
      var p = Math.min(1, (now - start) / dur);
      onUpdate(from + (to - from) * ease(p), p);
      if (p < 1) { raf = requestAnimationFrame(step); }
      else if (onDone) { onDone(); }
    }
    raf = requestAnimationFrame(step);
    return function cancel() { if (raf) cancelAnimationFrame(raf); };
  }

  /* ---------- 1. 主题：玄夜 / 宣纸 ---------- */
  var THEME_KEY = 'spark.theme';
  function setTheme(name) {
    doc.setAttribute('data-theme', name);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', name === 'light' ? '#f3f1f0' : '#090a0c');
    try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* 隐私模式下忽略 */ }
  }
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (saved === 'light' || saved === 'dark') { doc.setAttribute('data-theme', saved); return; }
    var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    doc.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
  })();

  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(doc.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    });
  }

  /* ---------- 2. 动效档位 ----------
     应用里 MotionMode 只有 'always' | 'auto' 两档（settings.ts:135 默认 'always'；
     theme.ts:85 把 always 写成 data-motion="full"，auto 则移除该属性去跟随系统）。
     网页这里多补一个彻底关闭档，是给访问者的额外便利，语义上不冒充应用的能力。 */
  var MOTION_KEY = 'spark.motion';
  var motionToggle = document.getElementById('motionToggle');
  var sysReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function computeReduce() {
    var mode = doc.getAttribute('data-motion');
    if (mode === 'off') return true;
    if (mode === 'auto') return !!(sysReduce && sysReduce.matches);
    return false; // full（默认）：忽略系统设置
  }

  function applyMotion(mode) {
    doc.setAttribute('data-motion', mode);
    reduceMotion = computeReduce();
    if (motionToggle) {
      motionToggle.title = mode === 'full' ? '界面动效：始终播放（默认）'
        : mode === 'auto' ? '界面动效：跟随系统'
          : '界面动效：关闭（网页额外提供）';
    }
    // 关掉动效时，把所有尚未入场的元素直接放到位
    if (reduceMotion) {
      document.querySelectorAll('.will-reveal').forEach(function (el) { el.classList.add('is-in'); });
    }
    try { localStorage.setItem(MOTION_KEY, mode); } catch (e) {}
  }

  var savedMotion = null;
  try { savedMotion = localStorage.getItem(MOTION_KEY); } catch (e) {}
  applyMotion(savedMotion === 'auto' || savedMotion === 'off' ? savedMotion : 'full');

  if (motionToggle) {
    motionToggle.addEventListener('click', function () {
      var order = ['full', 'auto', 'off'];
      var cur = doc.getAttribute('data-motion');
      applyMotion(order[(order.indexOf(cur) + 1) % order.length]);
    });
  }
  if (sysReduce && sysReduce.addEventListener) {
    sysReduce.addEventListener('change', function () {
      if (doc.getAttribute('data-motion') === 'auto') applyMotion('auto');
    });
  }

  /* ---------- 3. 滚动入场 ----------
     渐进增强：内容默认可见，只有这里确认「本环境能动效」才隐藏并逐帧放行。
     任何一步失败都不会让正文变成空白。 */
  (function reveals() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    // 环境不支持 / 动效关闭 / 页面在后台 → 什么都不做，正文保持可见
    if (!('IntersectionObserver' in window) || reduceMotion) return;

    items.forEach(function (el) { el.classList.add('will-reveal'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        // 同组元素错峰入场：按容器内序号给一点延迟
        var siblings = el.parentElement ? el.parentElement.querySelectorAll('[data-reveal]') : null;
        var idx = siblings ? Array.prototype.indexOf.call(siblings, el) : 0;
        var delay = Math.min(idx, 5) * 70;
        setTimeout(function () { el.classList.add('is-in'); }, delay);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    items.forEach(function (el) { io.observe(el); });

    // 兜底：正常情况下观察器会立刻放行首屏元素。若 1.6 秒后一个都没放行，
    // 说明本环境根本不会回调（某些无头 / 节能 / 离屏环境会把窗口判定为不可见），
    // 那就全部放行 —— 宁可丢掉动画，也绝不让正文停在空白状态。
    setTimeout(function () {
      if (document.querySelectorAll('.will-reveal.is-in').length > 0) return;
      items.forEach(function (el) { el.classList.add('is-in'); });
    }, 1600);
  })();

  /* ---------- 4. 数字滚动 ---------- */
  (function counters() {
    var nums = Array.prototype.slice.call(document.querySelectorAll('.stat__num'));
    if (!nums.length) return;

    function animate(el) {
      var small = el.querySelector('small');
      var smallHTML = small ? small.outerHTML : '';
      var target = parseInt(el.textContent, 10);
      if (isNaN(target)) return;
      var suffix = smallHTML;

      if (reduceMotion) { el.innerHTML = target + suffix; return; }

      tween({
        from: 0, to: target, duration: 900, ease: EASE_ENTER,
        onUpdate: function (v) { el.innerHTML = Math.round(v) + suffix; }
      });
    }

    if (!('IntersectionObserver' in window)) { nums.forEach(animate); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        animate(e.target);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { io.observe(n); });
  })();

  /* ---------- 5. 论衡评分条：写入目标宽度，交给 CSS 插值 ----------
     这正是应用里进度条采用的混合用法（JS 写目标值 + CSS transition）。
     同样带兜底：观察器不回调时直接填满，避免只剩空轨道。 */
  (function axes() {
    var bars = Array.prototype.slice.call(document.querySelectorAll('.axis__fill'));
    if (!bars.length) return;

    var done = 0;
    function fill(el) {
      if (el.dataset.filled) return;
      el.dataset.filled = '1';
      done++;
      var v = parseFloat(el.getAttribute('data-fill')) || 0;
      requestAnimationFrame(function () { el.style.width = Math.max(0, Math.min(100, v)) + '%'; });
    }

    if (!('IntersectionObserver' in window) || reduceMotion) { bars.forEach(fill); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        fill(e.target);
      });
    }, { threshold: 0.35 });
    bars.forEach(function (b) { io.observe(b); });

    setTimeout(function () { if (done === 0) bars.forEach(fill); }, 1600);
  })();

  /* ---------- 6. 七大视图面板 ---------- */
  var VIEWS = {
    chat: {
      name: '对话', en: 'Dialogue', key: 'Ctrl+1',
      desc: '单模型智能体。既可以当聊天窗口用，也可以让它真正动手：读写代码、联网检索、执行命令、调用插件。',
      feats: [
        '流式输出，逐字呈现推理与回答',
        '工具调用卡片可展开，看清每一步做了什么',
        '图片输入，可直接分析截图与照片',
        '多会话并行，各自独立的工作区与上下文',
        '运行中可随时「停止」，不留悬空任务',
        '写盘与执行命令前弹审批，可记住选择'
      ]
    },
    council: {
      name: '混元', en: 'Council', key: 'Ctrl+2',
      desc: '多模型协作。4 个成员模型并行处理同一任务，另由 1 个独立验收模型审阅产出、纠正冲突、收敛出终稿。',
      feats: [
        '顶栏五模型槽位：1 个验收 + 4 个成员',
        '成员跑在各自独立会话里，保留工具与上下文',
        '可选协同轮：把彼此产出喂回再做一轮改进',
        '成员步数 / 重试 / 验收步数 / 重试均可单独配置',
        '单个成员失败被隔离，不拖垮整组',
        '独立会话区与记录区，不污染普通对话'
      ]
    },
    arena: {
      name: '论衡', en: 'Arena', key: 'Ctrl+3',
      desc: '多模型对抗评测。同题多答 → 裁判按维度打分 → 对抗轮互相批判 → 给出排名与融合结论。',
      feats: [
        '至少两个模型同题作答，便于横向比较',
        '评估维度可配置，默认正确性 / 完整性 / 可执行性 / 简洁度',
        '轮次可设，支持多轮迭代',
        '对抗轮让参战模型互相批判并改进',
        '输出排名与融合结论，直接可用',
        '历史评测记录可回看与删除'
      ]
    },
    training: {
      name: '训练', en: 'Forge', key: 'Ctrl+4',
      desc: '视觉模型训练闭环。数据集管理、参数配置、实时日志、权重导出都在同一个页面里完成，不需要另搭脚本环境。',
      feats: [
        '支持分类 / 检测 / 分割 / 嵌入四类任务',
        '数据集一键划分训练 / 验证 / 测试集',
        '默认框架 ultralytics，可切换 timm',
        '训练进度以结构化事件实时回流到日志面板',
        '训练中可随时中止，不留僵尸进程',
        '评估指标并导出 ONNX / TorchScript 权重'
      ]
    },
    plugins: {
      name: '扩展', en: 'Tools', key: 'Ctrl+5',
      desc: '55 个插件按需启停，其中 54 个为模型增加工具能力。默认开启「除危险级外全部可用」，危险级需要显式打开。',
      feats: [
        '七个分类：文件、联网、计算、智能体、模型、训练、系统',
        '每个插件可单独开关，依赖关系自动处理',
        '插件可带工具、界面入口或后台任务',
        '运行统计：调用次数与最近使用时间',
        '插件级配置项，可按插件单独调整',
        '默认关闭一切危险级能力'
      ]
    },
    settings: {
      name: '设置', en: 'Settings', key: 'Ctrl+6',
      desc: '八个分组把可调项集中在一处：提供方、混元、智能体、安全、联网、训练、外观、关于。',
      feats: [
        '提供方：18 家内置 + 任意自定义 API，可「发现模型」',
        '智能体：默认模型、最大步数、温度、上下文预算、重试策略',
        '安全：权限模式、工作区白名单、命令白 / 黑名单、审批开关',
        '联网：搜索引擎选择、结果数量、缓存时长',
        '训练：Python 路径、脚本目录、工作目录、默认框架',
        '外观：配色方案、界面动效、字号、天气显示'
      ]
    },
    stats: {
      name: '统计', en: 'Stats', key: 'Ctrl+7',
      desc: '按时间维度看 token 用量、费用、调用次数与日志趋势，用于核算成本与判断模型性价比。',
      feats: [
        'token 用量与费用趋势曲线',
        '按厂商与模型拆分的调用统计',
        '运行次数、成功率与延迟',
        '工具调用记录，可回溯每一次执行',
        '运行日志在线查看',
        '为「值不值得上混元」提供数据依据'
      ]
    }
  };

  var viewBody = document.getElementById('viewBody');
  var viewTabs = Array.prototype.slice.call(document.querySelectorAll('.view-tab'));
  var currentView = 'chat';

  function renderView(id, animate) {
    var v = VIEWS[id];
    if (!v || !viewBody) return;

    var html =
      '<div class="view-panel__head">' +
        '<span class="view-panel__title">' + v.name + '</span>' +
        '<span class="view-panel__en">' + v.en + '</span>' +
        '<span class="view-tab__key" style="margin-left:auto">' + v.key + '</span>' +
      '</div>' +
      '<p class="view-panel__desc">' + v.desc + '</p>' +
      '<ul class="feature-list">' +
        v.feats.map(function (f) { return '<li>' + f + '</li>'; }).join('') +
      '</ul>';

    viewBody.innerHTML = html;

    if (animate && !reduceMotion) {
      // 逐帧淡入 + 轻微上移（沿用 EASE_ENTER）
      viewBody.style.opacity = '0';
      viewBody.style.transform = 'translate3d(0, 10px, 0)';
      tween({
        from: 0, to: 1, duration: 380, ease: EASE_ENTER,
        onUpdate: function (p) {
          viewBody.style.opacity = String(p);
          viewBody.style.transform = 'translate3d(0,' + (10 * (1 - p)).toFixed(2) + 'px,0)';
        },
        onDone: function () {
          viewBody.style.opacity = '';
          viewBody.style.transform = '';
        }
      });
    }
  }

  viewTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var id = tab.getAttribute('data-view');
      if (id === currentView) return;
      currentView = id;
      viewTabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      renderView(id, true);
    });
  });

  renderView('chat', false);

  /* ---------- 7. 插件分类 ---------- */
  // 工具名与分类计数取自源码实际暴露的 tool.schema.name
  var PLUGINS = [
    { name: '文件与代码', en: 'file', n: 10, tools: ['fs_read', 'write_file', 'apply_patch', 'fs_list', 'fs_glob', 'code_search', 'fs_delete', 'file_watch', 'notebook_edit', 'fs_hash'] },
    { name: '模型能力', en: 'model', n: 8, tools: ['model_route', 'model_compare', 'prompt_library', 'consensus_vote', 'cache_query', 'usage_report', 'vector_index', 'audit_log'] },
    { name: '计算与数据', en: 'compute', n: 8, tools: ['shell_exec', 'py_run', 'js_eval', 'data_transform', 'doc_parse', 'pdf_forge', 'image_ops', 'archive_ops'] },
    { name: '智能体协作', en: 'agent', n: 8, tools: ['todo_plan', 'delegate_task', 'memory_store', 'goal_track', 'context_compact', 'mcp_client', 'rate_guard', 'structured_extract'] },
    { name: '系统与偏好', en: 'system', n: 7, tools: ['app_settings', 'secret_status', 'os_open', 'notify_user', 'clipboard_io', 'screen_capture', 'audit_trail'] },
    { name: '模型训练', en: 'training', n: 7, tools: ['dataset_build', 'training_launch', 'training_monitor', 'model_evaluate', 'model_export', 'vision_infer', 'torch_env'] },
    { name: '联网与检索', en: 'web', n: 6, tools: ['web_search', 'web_fetch', 'web_browse', 'rss_read', 'wiki_lookup', 'knowledge_save'] }
  ];

  var catBox = document.getElementById('pluginCats');
  var toolBox = document.getElementById('pluginTools');
  var countEl = document.getElementById('pluginCount');
  var countLabel = document.getElementById('pluginCountLabel');

  function renderPlugins(idx) {
    if (!catBox || !toolBox) return;
    var cat = PLUGINS[idx];

    catBox.innerHTML = PLUGINS.map(function (c, i) {
      return '<button class="plugin-cat' + (i === idx ? ' is-active' : '') + '" type="button" data-cat="' + i + '"' +
        ' role="tab" aria-selected="' + (i === idx ? 'true' : 'false') + '">' +
        '<span class="plugin-cat__name">' + c.name + '</span>' +
        '<span class="plugin-cat__n">' + c.n + '</span>' +
        '</button>';
    }).join('');

    // 当前分类高亮，其余分类的工具淡出显示，便于一眼看出规模
    var others = [];
    PLUGINS.forEach(function (c, i) { if (i !== idx) others = others.concat(c.tools); });

    toolBox.innerHTML =
      cat.tools.map(function (t) { return '<span class="tool">' + t + '</span>'; }).join('') +
      others.slice(0, 26).map(function (t) { return '<span class="tool is-dim">' + t + '</span>'; }).join('');

    if (countEl) countEl.textContent = String(cat.n);
    if (countLabel) countLabel.textContent = '个工具 · 共 54 个';

    Array.prototype.forEach.call(catBox.querySelectorAll('.plugin-cat'), function (btn) {
      btn.addEventListener('click', function () {
        renderPlugins(parseInt(btn.getAttribute('data-cat'), 10));
      });
    });
  }
  renderPlugins(0);

  /* ---------- 8. 顶部：滚动状态 + 阅读进度 ---------- */
  var nav = document.getElementById('nav');
  var progress = document.getElementById('progress');
  var toTop = document.getElementById('toTop');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset || 0;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var p = Math.min(1, y / max);

      if (nav) nav.classList.toggle('is-scrolled', y > 12);
      if (progress) progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (toTop) toTop.classList.toggle('is-on', y > 760);

      highlightNav(y);
      ticking = false;
    });
  }

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var sections = navLinks.map(function (a) {
    var id = a.getAttribute('href');
    return { link: a, el: id && id.charAt(0) === '#' ? document.querySelector(id) : null };
  }).filter(function (s) { return s.el; });

  function highlightNav(y) {
    var probe = y + window.innerHeight * 0.32;
    var active = null;
    sections.forEach(function (s) {
      if (s.el.offsetTop <= probe) active = s;
    });
    navLinks.forEach(function (a) { a.classList.remove('is-active'); });
    if (active) active.link.classList.add('is-active');
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      try { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }
      catch (e) { window.scrollTo(0, 0); }
    });
  }

  /* ---------- 9. 首屏：指针跟随光晕 + 视差（逐帧插值） ---------- */
  (function heroMotion() {
    var hero = document.getElementById('hero');
    var glow = document.getElementById('heroGlow');
    var mock = document.getElementById('heroMock');
    if (!hero) return;

    var cur = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };
    var raf = 0;
    var running = false;

    function loop() {
      // 指数逼近，等价于带阻尼的跟随
      cur.x += (target.x - cur.x) * 0.09;
      cur.y += (target.y - cur.y) * 0.09;

      if (glow) {
        glow.style.transform = 'translate3d(' + (cur.x - 230).toFixed(1) + 'px,' + (cur.y - 230).toFixed(1) + 'px,0)';
      }
      if (mock && !reduceMotion) {
        var rx = (cur.x / hero.clientWidth - 0.5) * 2;
        var ry = (cur.y / Math.max(1, hero.clientHeight) - 0.5) * 2;
        mock.style.transform = 'perspective(1400px) rotateY(' + (rx * 1.6).toFixed(2) + 'deg) rotateX(' + (-ry * 1.2).toFixed(2) + 'deg) translate3d(0,0,0)';
      }

      if (Math.abs(target.x - cur.x) > 0.3 || Math.abs(target.y - cur.y) > 0.3) {
        raf = requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }

    function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }

    hero.addEventListener('pointermove', function (e) {
      if (reduceMotion) return;
      var rect = hero.getBoundingClientRect();
      target.x = e.clientX - rect.left;
      target.y = e.clientY - rect.top;
      hero.classList.add('is-pointer');
      start();
    });

    hero.addEventListener('pointerleave', function () {
      hero.classList.remove('is-pointer');
      if (glow) glow.style.opacity = '0';
      if (mock && !reduceMotion) {
        // 指针离开时把窗口姿态逐帧回正
        var rx0 = parseFloat((/rotateY\((-?[\d.]+)deg\)/.exec(mock.style.transform) || [0, 0])[1]) || 0;
        var ry0 = parseFloat((/rotateX\((-?[\d.]+)deg\)/.exec(mock.style.transform) || [0, 0])[1]) || 0;
        tween({
          from: 0, to: 1, duration: 420, ease: EASE_STANDARD,
          onUpdate: function (p) {
            var k = 1 - p;
            mock.style.transform = 'perspective(1400px) rotateY(' + (rx0 * k).toFixed(2) + 'deg) rotateX(' + (ry0 * k).toFixed(2) + 'deg) translate3d(0,0,0)';
          },
          onDone: function () { mock.style.transform = ''; }
        });
      }
    });

    // 动效被关闭时清掉指针视差留下的内联变换
    if (motionToggle) {
      motionToggle.addEventListener('click', function () {
        if (glow) glow.style.transform = '';
        if (mock) { mock.style.transform = ''; mock.style.opacity = ''; }
      });
    }
  })();

  /* ---------- 10. 锚点平滑滚动（动效关闭时退化为直接跳转） ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      var el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      var top = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - 76;
      try { window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' }); }
      catch (err) { window.scrollTo(0, top); }
      if (history.replaceState) history.replaceState(null, '', href);
    });
  });

  /* ---------- 11. 横向照片栏 ----------
     一条可横拖的实拍栏：拖动、滚轮、方向键、翻页按钮四种走法都能用。
     居中的卡片轻微抬亮抬高，让「横着看」这件事本身有反馈。 */
  Array.prototype.slice.call(document.querySelectorAll('.rail-shell')).forEach(function (shell) {
    var rail = shell.querySelector('.rail');
    if (!rail) return;
    var prev = shell.querySelector('[data-rail-prev]');
    var next = shell.querySelector('[data-rail-next]');
    var bar = shell.querySelector('[data-rail-bar]');
    var items = Array.prototype.slice.call(rail.querySelectorAll('.rail__item'));
    if (!items.length) return;

    function step() {
      // 用实际渲染出的卡片宽度，而不是写死的数字，窄屏才不会跳空
      var cs = window.getComputedStyle(rail);
      var gap = parseFloat(cs.columnGap || cs.gap) || 18;
      return items[0].getBoundingClientRect().width + gap;
    }

    function maxScroll() {
      return Math.max(0, rail.scrollWidth - rail.clientWidth);
    }

    function sync() {
      var max = maxScroll();
      var x = rail.scrollLeft;
      if (bar) {
        // 轨道固定 26% 宽，靠位移表达进度
        var track = bar.parentNode.getBoundingClientRect().width;
        var w = track * 0.26;
        var travel = Math.max(0, track - w);
        var p = max > 0 ? Math.min(1, Math.max(0, x / max)) : 0;
        bar.style.width = w + 'px';
        bar.style.transform = 'translateX(' + (p * travel).toFixed(1) + 'px)';
      }
      if (prev) prev.disabled = x <= 1;
      if (next) next.disabled = x >= max - 1;
    }

    // 居中卡片抬亮：距离中心越近，越靠前
    var focusRaf = 0;
    function refocus() {
      focusRaf = 0;
      if (reduceMotion) {
        items.forEach(function (it) { it.style.setProperty('--focus', '0'); });
        return;
      }
      // 先读完所有几何，再统一写回 —— 读写交替会让浏览器每张卡都重排一次
      var base = rail.getBoundingClientRect().left;
      var mid = base + rail.clientWidth / 2;
      var span = rail.clientWidth * 0.62;
      var vals = items.map(function (it) {
        var r = it.getBoundingClientRect();
        var d = Math.min(1, Math.abs(r.left + r.width / 2 - mid) / span);
        return (1 - d).toFixed(3);
      });
      items.forEach(function (it, i) { it.style.setProperty('--focus', vals[i]); });
    }
    function onRailScroll() {
      sync();
      if (!focusRaf) focusRaf = requestAnimationFrame(refocus);
    }

    /* 滚进视口放大、滚出缩小。
       用 IntersectionObserver 而不是监听 scroll：判定在合成线程上做，
       不用每帧回主线程量几何。阈值带一点回差（进 0.55 / 出 0.35），
       卡片停在边界上时不会来回抖。 */
    (function zoomOnScroll() {
      // 只给截图条做缩放：动效条那 10 帧是同一段时间序列的切片，
      // 各自大小不一就比不出「宽度一路收窄」了。
      if (reduceMotion || !('IntersectionObserver' in window)) return;
      if (rail.classList.contains('rail--anim')) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var cur = en.target.getAttribute('data-zoom') === '1';
          if (!cur && en.intersectionRatio >= 0.55) {
            en.target.setAttribute('data-zoom', '1');
            en.target.style.setProperty('--zoom', '1');
          } else if (cur && en.intersectionRatio < 0.35) {
            en.target.setAttribute('data-zoom', '0');
            en.target.style.setProperty('--zoom', '0');
          }
        });
      }, { root: rail, threshold: [0, 0.35, 0.55, 0.8, 1] });
      items.forEach(function (it) {
        it.setAttribute('data-zoom', '0');
        it.style.setProperty('--zoom', '0');
        io.observe(it);
      });
    })();

    /* 拖动：只接管横向，纵向仍交给页面滚动 */
    var down = false, moved = false, startX = 0, startLeft = 0;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; moved = false;
      startX = e.clientX; startLeft = rail.scrollLeft;
      rail.classList.add('is-dragging');
      if (rail.setPointerCapture) { try { rail.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    rail.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      rail.scrollLeft = startLeft - dx;
      if (moved) e.preventDefault();
    });
    function release() {
      if (!down) return;
      down = false;
      rail.classList.remove('is-dragging');
      // 松手就停在原地，不做「对齐到最近一张」——那一下吸附就是顿挫感的来源。
      // 只有按钮和方向键才按整张步进，拖动是无极的。
      if (moved) refocus();
    }
    rail.addEventListener('pointerup', release);
    rail.addEventListener('pointercancel', release);
    rail.addEventListener('pointerleave', release);

    /* 逐帧滑动，和站点其它动效走同一套缓动 */
    var glideCancel = null;
    function glide(target) {
      var max = maxScroll();
      target = Math.min(max, Math.max(0, target));
      if (glideCancel) glideCancel();
      if (reduceMotion) { rail.scrollLeft = target; sync(); return; }
      var from = rail.scrollLeft;
      if (Math.abs(target - from) < 1) { sync(); return; }
      rail.style.scrollBehavior = 'auto'; // 自己驱动，别叠加 CSS 平滑
      glideCancel = tween({
        from: from, to: target, duration: 520, ease: EASE_ENTER,
        onUpdate: function (v) { rail.scrollLeft = v; },
        onDone: function () { glideCancel = null; rail.style.scrollBehavior = ''; refocus(); }
      });
    }

    if (prev) prev.addEventListener('click', function () { glide(rail.scrollLeft - step() * 2); });
    if (next) next.addEventListener('click', function () { glide(rail.scrollLeft + step() * 2); });

    /* 不劫持纵向滚轮：横向滚轮或按住 Shift 才接管 */
    rail.addEventListener('wheel', function (e) {
      var horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontal && !e.shiftKey) return;
      e.preventDefault();
      rail.scrollLeft += horizontal ? e.deltaX : e.deltaY;
    }, { passive: false });

    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); glide(rail.scrollLeft + step()); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); glide(rail.scrollLeft - step()); }
      else if (e.key === 'Home') { e.preventDefault(); glide(0); }
      else if (e.key === 'End') { e.preventDefault(); glide(maxScroll()); }
    });

    rail.addEventListener('scroll', onRailScroll, { passive: true });
    window.addEventListener('resize', onRailScroll);
    sync();
    refocus();

    /* 栏里的图是 loading="lazy"：横着滑过去时它们才进视口，
       等那时再解码就会闪一下空白。这里在页面闲下来之后按顺序预热。
       每张图自己解码完也登记一次，不依赖预热是否插得进去。 */
    (function warm() {
      var imgs = Array.prototype.slice.call(rail.querySelectorAll('img'));
      imgs.forEach(function (el) {
        var frame = el.closest('.rail__frame') || el.parentNode;
        function mark() {
          el.classList.add('is-ready');
          if (frame && frame.classList) frame.classList.remove('is-loading');
        }
        if (!(el.complete && el.naturalWidth) && frame && frame.classList) frame.classList.add('is-loading');
        if (el.complete && el.naturalWidth) mark();
        else el.addEventListener('load', mark, { once: true });
        el.addEventListener('error', mark, { once: true });
      });

      var i = 0;
      function next() {
        if (i >= imgs.length) return;
        var el = imgs[i++];
        if (el.complete) { next(); return; }
        var pre = new Image();
        pre.onload = pre.onerror = next;
        pre.src = el.currentSrc || el.src;
      }
      var start = function () { setTimeout(next, 60); };
      if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 1200 });
      else setTimeout(start, 320);
    })();

    // 动效开关变化时同步一次（关闭后不再做居中强调）
    if (motionToggle) motionToggle.addEventListener('click', function () { setTimeout(onRailScroll, 30); });

    /* ---------------------------------------------------------------
       点开看原图。
       用原生 <dialog> + showModal()：焦点陷阱、Esc 关闭、背景滚动锁定
       都是浏览器给的，不用自己实现。只接管外观与进出场。

       两档观感：
         fit    —— 整张图缩到视口里，看得全（默认，一进来先看整体）
         actual —— 按原尺寸 1:1 显示，舞台里可以拖/滚看细节
       缩到 fit 只有约 74%，界面里那些 11px 的小字会更小 ——
       要看细节就切 actual，那一档是按 1 CSS 像素 = 1 图片像素 给的。
       --------------------------------------------------------------- */
    var lightbox = document.getElementById('lightbox');
    if (lightbox && typeof lightbox.showModal === 'function') {
      var lbImg = q('[data-lb-img]', lightbox);
      var lbTitle = q('[data-lb-title]', lightbox);
      var lbCounter = q('[data-lb-counter]', lightbox);
      var lbClose = q('[data-lb-close]', lightbox);
      var lbPrev = q('[data-lb-prev]', lightbox);
      var lbNext = q('[data-lb-next]', lightbox);
      var lbStage = q('[data-lb-stage]', lightbox);
      var lbZoomBtn = q('[data-lb-zoom-toggle]', lightbox);
      var lbZoomLabel = q('[data-lb-zoom-label]', lightbox);
      var dragMoved = false;
      var lbTimer = 0;
      var lbIndex = -1;
      var lbOpen = false;
      var lbActual = false;
      var OUT_MS = 200;

      function frameAt(i) {
        return (i % items.length + items.length) % items.length;
      }

      // fit: 按钮提示「看原尺寸」；actual: 按钮提示「适应窗口」
      function syncZoomUI() {
        lightbox.setAttribute('data-lb-zoom', lbActual ? 'actual' : 'fit');
        if (lbZoomLabel) lbZoomLabel.textContent = lbActual ? '适应' : '100%';
        if (lbZoomBtn) lbZoomBtn.setAttribute('aria-label', lbActual ? '缩小到适应窗口' : '按原尺寸查看');
      }

      function setActual(on) {
        lbActual = !!on;
        syncZoomUI();
        if (lbActual) scrollCenter();
      }

      // actual 档：把图片的中间对到舞台中间，别一上来就贴着左上角
      function scrollCenter() {
        lbStage.scrollLeft = Math.max(0, (lbStage.scrollWidth - lbStage.clientWidth) / 2);
        lbStage.scrollTop = Math.max(0, (lbStage.scrollHeight - lbStage.clientHeight) / 2);
      }

      function render(i) {
        var it = items[i];
        var frame = q('.rail__frame', it);
        if (!frame) return;
        lbIndex = i;
        lbImg.src = frame.getAttribute('data-shot');
        var alt = q('img', frame);
        lbImg.alt = alt ? alt.getAttribute('alt') : '';
        lbTitle.textContent = frame.getAttribute('data-shot-title') || '';
        lbCounter.textContent = (i + 1) + ' / ' + items.length;
        // 换图时先把旧尺寸清掉，否则会按上一张的比例撑一下
        lbImg.style.width = '';
        lbImg.style.height = '';
        lbImg.setAttribute('data-loading', '');
        if (lbImg.complete && lbImg.naturalWidth) lbImg.removeAttribute('data-loading');
      }

      function openAt(i) {
        clearTimeout(lbTimer);
        lbActual = false;
        syncZoomUI();
        render(i);
        if (!lbOpen) {
          lightbox.showModal();
          lbOpen = true;
          // 先以「缩着 + 透明」上屏，再在一帧后放行，过渡才会真的跑
          void lightbox.offsetWidth;
          lightbox.setAttribute('data-open', '1');
        }
      }

      function closeBox() {
        if (!lbOpen) return;
        lightbox.removeAttribute('data-open');
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          lightbox.close();
        }
        if (reduceMotion) { finish(); return; }
        lightbox.addEventListener('transitionend', finish, { once: true });
        lbTimer = setTimeout(finish, OUT_MS + 120);
      }

      // 切换那一张时，先把卡片滚到轨道中间 —— 关掉之后视线停在原地
      function center(i) {
        var it = items[i];
        var max = maxScroll();
        var x = it.offsetLeft - (rail.clientWidth - it.offsetWidth) / 2;
        rail.scrollLeft = Math.min(max, Math.max(0, x));
        refocus();
      }

      function step2(d) {
        var next = frameAt(lbIndex + d);
        render(next);
        center(next);
        if (lbActual) requestAnimationFrame(scrollCenter);
      }

      // 拖动过程中松手会补一次 click，这里把它吃掉
      rail.addEventListener('click', function (e) {
        if (dragMoved) { e.preventDefault(); e.stopPropagation(); }
      }, true);

      function onFrameActivate(e) {
        var frame = e.target.closest ? e.target.closest('.rail__frame') : null;
        if (!frame || !rail.contains(frame)) return;
        if (dragMoved) return;
        e.preventDefault();
        openAt(items.indexOf(frame.closest('.rail__item')));
      }

      rail.addEventListener('click', onFrameActivate);
      rail.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        // 空格只对卡片生效，别把 rail 自己的方向键逻辑搅乱
        onFrameActivate(e);
      });

      // 拖动之后松手会补一次 click，靠这个标记吃掉。
      // 拖动结束必须清掉：否则之后用键盘回车开图会被它一直挡着。
      var pdX = 0;
      function endDrag() { setTimeout(function () { dragMoved = false; }, 0); }
      rail.addEventListener('pointerdown', function (e) { pdX = e.clientX; dragMoved = false; }, true);
      rail.addEventListener('pointermove', function (e) {
        if (Math.abs(e.clientX - pdX) > 6) dragMoved = true;
      }, true);
      rail.addEventListener('pointerup', endDrag, true);
      rail.addEventListener('pointercancel', endDrag, true);

      if (lbClose) lbClose.addEventListener('click', closeBox);
      if (lbPrev) lbPrev.addEventListener('click', function () { step2(-1); });
      if (lbNext) lbNext.addEventListener('click', function () { step2(1); });
      if (lbZoomBtn) lbZoomBtn.addEventListener('click', function () { setActual(!lbActual); });

      lbImg.addEventListener('load', function () {
        lbImg.removeAttribute('data-loading');
        if (lbActual) scrollCenter();
      });
      lbImg.addEventListener('error', function () { lbImg.removeAttribute('data-loading'); });

      /* actual 档的拖动：舞台本身就是滚动容器，所以自己接管 pointer
         —— 不 preventDefault，浏览器就不会把这次手势当成文字选择或原生滚动。 */
      (function panStage() {
        var panning = false;
        var panMoved = false;
        var sx = 0, sy = 0, sl = 0, st = 0;
        lbStage.addEventListener('pointerdown', function (e) {
          if (!lbActual || e.button !== 0) return;
          panning = true; panMoved = false;
          sx = e.clientX; sy = e.clientY;
          sl = lbStage.scrollLeft; st = lbStage.scrollTop;
          lbStage.classList.add('is-panning');
          if (lbStage.setPointerCapture) { try { lbStage.setPointerCapture(e.pointerId); } catch (err) {} }
        });
        lbStage.addEventListener('pointermove', function (e) {
          if (!panning) return;
          var dx = e.clientX - sx, dy = e.clientY - sy;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMoved = true;
          lbStage.scrollLeft = sl - dx;
          lbStage.scrollTop = st - dy;
          if (panMoved) e.preventDefault();
        });
        function up() {
          if (!panning) return;
          panning = false;
          lbStage.classList.remove('is-panning');
        }
        lbStage.addEventListener('pointerup', up);
        lbStage.addEventListener('pointercancel', up);
        // 拖完松手那一下也会派发 click，别让它顺手把放大层关了
        lbStage.addEventListener('click', function (e) {
          if (panMoved) { e.stopPropagation(); panMoved = false; }
        });
      })();

      /* 点背景关闭：dialog 占的是整块 backdrop，点击落在 dialog 自身而不是
         .lightbox__inner 上，就算点了外面 */
      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) closeBox();
      });
      lightbox.addEventListener('close', function () {
        lbOpen = false;
        lightbox.removeAttribute('data-open');
        lbImg.removeAttribute('src');
        lbImg.removeAttribute('data-loading');
        if (lbIndex >= 0 && items[lbIndex]) {
          var back = q('.rail__frame', items[lbIndex]);
          if (back) back.focus({ preventScroll: true }); // 焦点还回那张卡
        }
        onRailScroll();
      });

      lightbox.addEventListener('keydown', function (e) {
        if (!lbOpen) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); step2(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step2(-1); }
        else if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); setActual(!lbActual); }
      });
    }
  });

  /* ===================================================================
     §12 首屏示意图：让它真的动起来
     -------------------------------------------------------------------
     这台窗是**界面示意**，不是可操作的真软件：脚本自己跑一段循环，
     演一遍「侧栏推入 → 追问 → 逐步定位 → 工具卡片落位 → 逐字给结论」。
     节奏取自应用自己的实测值（侧栏展开 420ms、收起 550ms），
     但为了看得清，这里整体放慢到约 1.6 倍。

     动画只碰 opacity / transform / background-color —— 不动宽度。
     示意窗的栏宽是布局量，中途改它会让文字在每一帧重排；
     真软件里之所以能改，是因为它逐帧算好的。这里没有这个必要。
     =================================================================== */
  var mock = document.getElementById('heroMock');
  if (mock) (function () {
    var side = qa('[data-mock-side]', mock);
    var asides = qa('[data-mock-aside]', mock);
    var msgs = {};
    qa('[data-mock-msg]', mock).forEach(function (el) { msgs[el.getAttribute('data-mock-msg')] = el; });
    var tools = qa('[data-mock-tool]', mock);
    var toggle = q('[data-mock-toggle]', mock);
    var iconPause = q('[data-mock-icon="pause"]', mock);
    var iconPlay = q('[data-mock-icon="play"]', mock);

    // 结论那句要逐字吐出来，先把原文与尾部光标留住
    var finalEl = msgs.final;
    var finalBody = finalEl ? finalEl.textContent.replace(/\s+/g, ' ').trim() : '';
    var caret = finalEl ? q('.mock__caret', finalEl) : null;

    // 工具卡片有「读」和「跑完」两副面孔，原始标记各存一份
    var toolDone = tools.map(function (el) { return el.innerHTML; });
    var toolBusy = tools.map(function (el) {
      return '<span class="spin"></span>' + el.innerHTML.replace(/^[\s\S]*?<\/span>/, ' ');
    });

    var EASE = EASE_ENTER;
    var timers = [];
    var running = false;
    var paused = false;
    var visible = true;

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function streamText(el, text, total, done) {
      if (!el) { if (done) done(); return; }
      var t0 = 0;
      tween({
        from: 0, to: 1, duration: total, ease: function (p) { return p; },
        onUpdate: function (p) {
          var n = Math.round(p * text.length);
          if (n === t0) return;
          t0 = n;
          el.innerHTML = '';
          el.appendChild(document.createTextNode(text.slice(0, n)));
          if (caret) el.appendChild(caret);
        },
        onDone: function () { if (done) done(); }
      });
    }

    // 让一个元素先藏起来：读完它的当前态再写，避免闪一下
    function hide(el, dy) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(' + (dy == null ? 10 : dy) + 'px)';
    }
    function show(el, ms) {
      setTimeout(function () {
        el.style.transitionDuration = (ms || 380) + 'ms';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 0);
    }

    function rest() {
      // 全部回到终态（也是没脚本时的静态样）
      side.forEach(function (el) { el.style.opacity = ''; el.style.transform = ''; });
      asides.forEach(function (el) { el.style.opacity = ''; el.style.transform = ''; });
      tools.forEach(function (el, i) { el.innerHTML = toolDone[i]; el.style.cssText = ''; });
      Object.keys(msgs).forEach(function (k) { msgs[k].style.cssText = ''; });
      if (finalEl) {
        finalEl.innerHTML = '';
        finalEl.appendChild(document.createTextNode(finalBody));
        if (caret) { caret.style.opacity = ''; finalEl.appendChild(caret); }
      }
    }

    function runOnce(done) {
      rest();
      // 起点：侧栏一条条推入，右栏滑出 —— 对应应用里那两个 420ms
      var hidden = [];
      side.forEach(function (el, i) { hide(el, 8); hidden.push(el); });
      asides.forEach(function (el, i) { hide(el, 0); el.style.transform = 'translateX(10px)'; hidden.push(el); });
      Object.keys(msgs).forEach(function (k) { hide(msgs[k], 12); hidden.push(msgs[k]); });
      tools.forEach(function (el) { hide(el, 12); hidden.push(el); });
      if (caret) caret.style.opacity = '1';
      // 强制读一次布局，否则上面那批写入会被合并、过渡不触发
      void mock.offsetWidth;

      side.forEach(function (el, i) { later(function () { show(el, 300); }, i * 70); });
      asides.forEach(function (el, i) { later(function () { show(el, 340); }, 180 + i * 55); });

      later(function () { show(msgs.user, 400); }, 620);
      later(function () { show(msgs.think, 360); }, 1180);

      tools.forEach(function (el, i) {
        later(function () { el.innerHTML = toolBusy[i]; show(el, 340); }, 1620 + i * 520);
      });

      // 第一个工具卡从「转」变成「命中」
      later(function () { if (tools[0]) tools[0].innerHTML = toolDone[0]; }, 2650);

      later(function () {
        if (msgs.final) { msgs.final.style.opacity = '1'; msgs.final.style.transform = 'translateY(0)'; }
        streamText(finalEl, finalBody, 1900, null);
      }, 2900);

      var total = 5400;
      later(function () { running = false; if (done) done(); }, total);
      return total;
    }

    /* 每一轮都自足：从隐藏态演到终态，演完自己决定要不要接着演。
       注意这里**不能**用 running 当下一次的门 —— stop() 会把 running 置回 false，
       观察器抖动一下就足以让循环再也起不来。 */
    function schedule() {
      if (paused || !visible || document.hidden) { running = false; mark(); return; }
      running = true;
      mark();
      runOnce(function () { later(schedule, 1500); });
    }

    // 把运行状态写到 DOM 上：暂停/可见性出问题时能直接在审查器里看到
    function mark() {
      if (running) mock.setAttribute('data-mock-running', '');
      else mock.removeAttribute('data-mock-running');
    }

    function start() {
      if (paused || !visible || document.hidden) return;
      running = true;
      schedule();
    }
    function stop() { running = false; clearTimers(); mark(); }

    // 滚出视口就停掉省 CPU，回来接着演
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0.18 }).observe(mock);
    }
    // 先跑起来：示意图在首屏往往正好在折线下方，等观察器回调会显得「一进来就是静止的」
    start();

    if (toggle) toggle.addEventListener('click', function () {
      paused = !paused;
      mock.toggleAttribute('data-mock-paused', paused);
      if (paused) { stop(); rest(); }
      else { running = false; start(); }
      if (iconPause) iconPause.hidden = paused;
      if (iconPlay) iconPlay.hidden = !paused;
      toggle.setAttribute('aria-label', paused ? '继续界面动画' : '暂停界面动画');
    });

    // 页面切到后台时别空转
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });
  })();
})();
