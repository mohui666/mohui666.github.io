(function () {
    var list = document.getElementById("blog-list");
    if (!list) return;

    fetch("posts.json", { cache: "no-cache" })
        .then(function (res) {
            if (!res.ok) throw new Error("posts.json " + res.status);
            return res.json();
        })
        .then(function (data) {
            var posts = (data.posts || []).slice().sort(function (a, b) {
                return (b.date || "").localeCompare(a.date || "");
            });
            if (!posts.length) {
                list.innerHTML = '<p class="blog-empty">还没有笔记。往 posts.json 加一条，并放对应 HTML。</p>';
                return;
            }
            list.innerHTML = posts.map(function (post) {
                var tags = (post.tags || [])
                    .map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; })
                    .join("");
                return (
                    '<a class="card-link post-card" href="' + escapeAttr(post.url) + '">' +
                        "<time datetime=\"" + escapeAttr(post.date) + "\">" + escapeHtml(post.date) + "</time>" +
                        "<strong>" + escapeHtml(post.title) + "</strong>" +
                        "<span>" + escapeHtml(post.summary || "") + "</span>" +
                        (tags ? '<div class="tag-row">' + tags + "</div>" : "") +
                    "</a>"
                );
            }).join("");
        })
        .catch(function (err) {
            list.innerHTML = '<p class="blog-error">列表加载失败：' + escapeHtml(String(err.message || err)) + "</p>";
        });

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, "&#39;");
    }
})();
