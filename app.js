const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM references ---
const authScreen = document.getElementById("auth-screen");
const mainScreen = document.getElementById("main-screen");
const authTitle = document.getElementById("auth-title");
const authForm = document.getElementById("auth-form");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const toggleAuthLink = document.getElementById("toggle-auth");
const authError = document.getElementById("auth-error");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const logoutBtn = document.getElementById("logout-btn");
const userEmailDisplay = document.getElementById("user-email-display");
const tweetForm = document.getElementById("tweet-form");
const tweetInput = document.getElementById("tweet-input");
const charCount = document.getElementById("char-count");
const tweetSubmitBtn = document.getElementById("tweet-submit-btn");
const tweetFeed = document.getElementById("tweet-feed");

let isSignUp = false;
let currentUser = null;
let realtimeChannel = null;

// --- Auth state ---
sb.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    showMain();
  } else {
    showAuth();
  }
});

function showAuth() {
  authScreen.classList.remove("hidden");
  mainScreen.classList.add("hidden");
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function showMain() {
  authScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  userEmailDisplay.textContent = currentUser.email;
  loadTweets();
  subscribeToTweets();
}

// --- Toggle login / signup ---
toggleAuthLink.addEventListener("click", (e) => {
  e.preventDefault();
  isSignUp = !isSignUp;
  authTitle.textContent = isSignUp ? "新規登録" : "ログイン";
  authSubmitBtn.textContent = isSignUp ? "登録する" : "ログイン";
  toggleAuthLink.textContent = isSignUp ? "ログインはこちら" : "新規登録";
  document.querySelector(".auth-switch").firstChild.textContent = isSignUp
    ? "アカウントを持っている？ "
    : "アカウントがない？ ";
  authError.textContent = "";
});

// --- Auth form submit ---
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  authSubmitBtn.disabled = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  let error;
  if (isSignUp) {
    ({ error } = await sb.auth.signUp({ email, password }));
    if (!error) {
      authError.style.color = "#1d9bf0";
      authError.textContent = "確認メールを送りました。メールをご確認ください。";
    }
  } else {
    ({ error } = await sb.auth.signInWithPassword({ email, password }));
  }

  if (error) {
    authError.style.color = "#f4212e";
    authError.textContent = error.message;
  }
  authSubmitBtn.disabled = false;
});

// --- Logout ---
logoutBtn.addEventListener("click", async () => {
  await sb.auth.signOut();
});

// --- Character count ---
tweetInput.addEventListener("input", () => {
  const len = tweetInput.value.length;
  charCount.textContent = `${len} / 280`;
  tweetSubmitBtn.disabled = len === 0 || len > 280;
});

// --- Post tweet ---
tweetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = tweetInput.value.trim();
  if (!content || content.length > 280) return;

  tweetSubmitBtn.disabled = true;
  const { error } = await sb.from("tweets").insert({
    content,
    user_id: currentUser.id,
    user_email: currentUser.email,
  });

  if (error) {
    alert("投稿に失敗しました: " + error.message);
  } else {
    tweetInput.value = "";
    charCount.textContent = "0 / 280";
  }
  tweetSubmitBtn.disabled = false;
});

// --- Load tweets ---
async function loadTweets() {
  tweetFeed.innerHTML = '<p class="loading-msg">読み込み中...</p>';

  const { data, error } = await sb
    .from("tweets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    tweetFeed.innerHTML = '<p class="loading-msg">読み込みに失敗しました</p>';
    return;
  }

  renderTweets(data);
}

function renderTweets(tweets) {
  if (tweets.length === 0) {
    tweetFeed.innerHTML = '<p class="loading-msg">まだ投稿がありません</p>';
    return;
  }
  tweetFeed.innerHTML = tweets.map(tweetHTML).join("");
}

function tweetHTML(tweet) {
  const isOwner = currentUser && tweet.user_id === currentUser.id;
  const time = new Date(tweet.created_at).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const deleteBtn = isOwner
    ? `<button class="delete-btn" data-id="${tweet.id}">削除</button>`
    : "";

  return `
    <div class="tweet-card" data-id="${tweet.id}">
      <div class="tweet-meta">
        <span class="tweet-author">${escapeHtml(tweet.user_email)}</span>
        <span class="tweet-time">${time}</span>
      </div>
      <div class="tweet-body">${escapeHtml(tweet.content)}</div>
      <div class="tweet-actions">${deleteBtn}</div>
    </div>
  `;
}

// --- Delete tweet (event delegation) ---
tweetFeed.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("delete-btn")) return;
  const id = e.target.dataset.id;
  const { error } = await sb
    .from("tweets")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    alert("削除に失敗しました: " + error.message);
  }
});

// --- Realtime subscription ---
function subscribeToTweets() {
  realtimeChannel = sb
    .channel("tweets-channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tweets" },
      () => loadTweets()
    )
    .subscribe();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
