/**
 * Domain Monitor Worker
 * Ported from Flask to Cloudflare Workers (ESM)
 */

// HTML 模板生成函数 (包含前端 JS)
function renderHTML(domains, config, stats) {
  // 构建表格行
  const rows = domains.map(d => `
      <tr data-id="${d.id}">
          <td><input type="checkbox" class="chk" value="${d.id}"></td>
          <td class="drag-handle" style="cursor:grab; color:#666;">☰</td>
          <td>
              <div style="font-weight:bold;">${d.domain_name}</div>
              <div style="font-size:0.8em; color:#6c5ce7;">${d.remark}</div>
          </td>
          <td id="status-${d.id}">
              ${d.is_online 
                  ? `<span class="status-badge badge-ok">200 OK</span> <small>${d.response_time}ms</small>` 
                  : (d.status_code !== 'N/A' ? `<span class="status-badge badge-err">${d.status_code}</span>` : '<span style="color:#666">-</span>')
              }
          </td>
          <td class="hide-mobile">
              <span style="color:${d.days_to_expire < 30 ? '#d63031' : '#00b894'}">${d.days_to_expire} 天</span>
              <div style="font-size:0.75em; color:#888;">${d.expiration_date}</div>
          </td>
          <td style="text-align:right;">
              <button class="btn btn-primary" onclick="openEdit('${d.id}', '${d.domain_name}', '${d.remark}', '${d.registration_date}', '${d.expiration_date}')">✏️</button>
              <button class="btn btn-danger" onclick="delOne(${d.id})">🗑️</button>
          </td>
      </tr>
  `).join('');

  // 返回完整 HTML
  return `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Domain Monitor Pro</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
      :root { --bg:#121212; --card:#1e1e1e; --text:#e0e0e0; --accent:#6c5ce7; --danger:#d63031; --success:#00b894; }
      body { background:var(--bg); color:var(--text); font-family:'Segoe UI', sans-serif; margin:0; padding:20px; }
      .container { max-width:1200px; margin:0 auto; }
      .btn { padding:6px 12px; border:none; border-radius:6px; cursor:pointer; color:white; margin:2px; font-size:14px; }
      .btn-primary { background:var(--accent); } .btn-danger { background:var(--danger); } .btn-success { background:var(--success); } .btn-grey { background:#636e72; }
      .status-badge { padding:3px 8px; border-radius:4px; font-size:0.8em; }
      .badge-ok { background:rgba(0,184,148,0.2); color:var(--success); border:1px solid var(--success); }
      .badge-err { background:rgba(214,48,49,0.2); color:var(--danger); border:1px solid var(--danger); }
      table { width:100%; border-collapse:collapse; background:var(--card); margin-top:20px; border-radius:10px; overflow:hidden; }
      td, th { padding:12px; border-bottom:1px solid #333; text-align:left; }
      .stats-box { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; text-align:center; margin-bottom:20px; }
      .card { background:var(--card); padding:15px; border-radius:8px; border:1px solid #333; }
      .modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:999; }
      .modal-content { background:var(--card); width:90%; max-width:400px; margin:10% auto; padding:20px; border-radius:10px; }
      input { width:100%; padding:8px; margin:5px 0 10px; background:#333; border:none; color:white; border-radius:4px; box-sizing:border-box; }
  </style>
</head>
<body>
<div class="container">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h3><i class="fas fa-server"></i> DomainMonitor</h3>
      <div>
          <button class="btn btn-grey" onclick="document.getElementById('configModal').style.display='block'">⚙️ 设置/备份</button>
          <a href="/logout" class="btn btn-danger"><i class="fas fa-power-off"></i></a>
      </div>
  </div>

  <div class="stats-box">
      <div class="card">总数: ${stats.total}</div>
      <div class="card" style="color:var(--success)">在线: ${stats.online}</div>
      <div class="card" style="color:var(--danger)">异常: ${stats.issue}</div>
      <div class="card" style="color:orange">即将过期: ${stats.soon}</div>
  </div>

  <div style="display:flex; gap:10px; margin-bottom:15px;">
      <button onclick="document.getElementById('addModal').style.display='block'" class="btn btn-primary">➕ 添加</button>
      <button onclick="batchRefresh()" class="btn btn-success">🔄 刷新状态</button>
  </div>

  <table>
      <thead><tr><th width="30">#</th><th width="30"></th><th>域名 / 备注</th><th>状态</th><th>到期</th><th>操作</th></tr></thead>
      <tbody id="domainList">${rows}</tbody>
  </table>
</div>

<!-- Modal: Config -->
<div id="configModal" class="modal">
  <div class="modal-content">
      <h3>⚙️ 备份配置</h3>
      <div style="font-size:0.8em; color:#888; margin-bottom:10px;">配置信息将加密存储在 D1 数据库中</div>
      
      <label>Github Gist Token</label>
      <input type="password" id="cfg_gist_token" value="${config.gist_token || ''}">
      <div style="margin-bottom:15px;">
          <button onclick="cloudAction('gist','export')" class="btn btn-success">备份到 Gist</button>
          <button onclick="cloudAction('gist','import')" class="btn btn-primary">从 Gist 恢复</button>
          <small style="color:#666; margin-left:5px;">ID: ${config.gist_id || '未绑定'}</small>
      </div>

      <hr style="border:0; border-top:1px solid #444; margin:15px 0;">

      <label>WebDAV URL</label>
      <input type="text" id="cfg_webdav_url" value="${config.webdav_url || ''}">
      <label>WebDAV User</label>
      <input type="text" id="cfg_webdav_user" value="${config.webdav_user || ''}">
      <label>WebDAV Password</label>
      <input type="password" id="cfg_webdav_pass" value="${config.webdav_pass || ''}">
      <div style="margin-bottom:15px;">
          <button onclick="cloudAction('webdav','export')" class="btn btn-success">备份到 WebDAV</button>
          <button onclick="cloudAction('webdav','import')" class="btn btn-primary">从 WebDAV 恢复</button>
      </div>

      <div style="text-align:right; margin-top:20px;">
          <button onclick="document.getElementById('configModal').style.display='none'" class="btn btn-grey">关闭</button>
          <button onclick="saveConfig()" class="btn btn-primary">保存配置</button>
      </div>
  </div>
</div>

<!-- Modal: Add -->
<div id="addModal" class="modal">
  <div class="modal-content">
      <h3>批量添加</h3>
      <textarea id="bulkInput" rows="5" style="width:100%; background:#333; color:white; border:none; padding:10px;" placeholder="example.com"></textarea>
      <div style="text-align:right; margin-top:10px;">
          <button onclick="document.getElementById('addModal').style.display='none'" class="btn btn-grey">取消</button>
          <button onclick="addBulk()" class="btn btn-primary">确定</button>
      </div>
  </div>
</div>

<!-- Modal: Edit -->
<div id="editModal" class="modal">
  <div class="modal-content">
      <h3>编辑</h3>
      <input type="hidden" id="editId">
      <label>域名</label><input id="editDomain">
      <label>备注</label><input id="editRemark">
      <label>注册日期</label><input id="editReg" placeholder="YYYY-MM-DD">
      <label>到期日期</label><input id="editExp" placeholder="YYYY-MM-DD">
      <div style="text-align:right;">
          <button onclick="document.getElementById('editModal').style.display='none'" class="btn btn-grey">取消</button>
          <button onclick="submitEdit()" class="btn btn-primary">保存</button>
      </div>
  </div>
</div>

<script>
  // API Calls
  async function addBulk() {
      const fd = new FormData(); fd.append('domains', document.getElementById('bulkInput').value);
      await fetch('/api/add_bulk', {method:'POST', body:fd}); location.reload();
  }
  async function delOne(id) { if(confirm('确认删除?')) { await fetch('/api/delete/'+id, {method:'POST'}); location.reload(); } }
  
  function batchRefresh() {
      const ids = Array.from(document.querySelectorAll('.chk')).map(c=>c.value);
      if(!ids.length && !confirm('刷新全部?')) return; 
      const targetIds = ids.length ? ids : Array.from(document.querySelectorAll('.chk')).map(c=>c.value);
      
      targetIds.forEach((id, idx) => {
          setTimeout(() => {
              const el = document.getElementById('status-'+id);
              if(el) {
                  el.innerHTML = '...';
                  fetch('/api/refresh/'+id, {method:'POST'}).then(r=>r.json()).then(d=>{
                      const cls = d.online ? 'badge-ok' : 'badge-err';
                      const txt = d.online ? '200 OK' : d.code;
                      el.innerHTML = \`<span class="status-badge \${cls}">\${txt}</span> <small>\${d.ms}ms</small>\`;
                  });
              }
          }, idx * 200);
      });
  }

  // Config & Cloud Backup
  function saveConfig() {
      const fd = new FormData();
      fd.append('gist_token', document.getElementById('cfg_gist_token').value);
      fd.append('webdav_url', document.getElementById('cfg_webdav_url').value);
      fd.append('webdav_user', document.getElementById('cfg_webdav_user').value);
      fd.append('webdav_pass', document.getElementById('cfg_webdav_pass').value);
      fetch('/api/save_config', {method:'POST', body:fd}).then(r=>r.json()).then(d=>{ alert(d.msg); });
  }

  function cloudAction(service, action) {
      if(!confirm('确定执行 '+service+' '+action+'?')) return;
      fetch('/api/'+service+'/'+action, {method:'POST'}).then(r=>r.json()).then(d=>{
          alert(d.msg);
          if(d.status === 'success' && action === 'import') location.reload();
      });
  }

  // UI Helpers
  function openEdit(id, dom, rem, reg, exp) {
      document.getElementById('editModal').style.display='block';
      document.getElementById('editId').value = id;
      document.getElementById('editDomain').value = dom;
      document.getElementById('editRemark').value = rem;
      document.getElementById('editReg').value = reg;
      document.getElementById('editExp').value = exp;
  }
  function submitEdit() {
      const fd = new FormData();
      fd.append('id', document.getElementById('editId').value);
      fd.append('domain_name', document.getElementById('editDomain').value);
      fd.append('remark', document.getElementById('editRemark').value);
      fd.append('reg_date', document.getElementById('editReg').value);
      fd.append('exp_date', document.getElementById('editExp').value);
      fetch('/api/edit', {method:'POST', body:fd}).then(()=>location.reload());
  }
  window.onclick = function(e) { if(e.target.classList.contains('modal')) e.target.style.display='none'; }
</script>
</body>
</html>
  `;
}

// 简单的登录页面
const LOGIN_HTML = `
<!DOCTYPE html><html><body style="background:#121212;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
<form method="POST" style="text-align:center;">
  <h3>Domain Monitor</h3>
  <input type="password" name="password" placeholder="Password" style="padding:10px;border-radius:5px;border:none;">
  <button type="submit" style="padding:10px;border-radius:5px;border:none;background:#6c5ce7;color:white;cursor:pointer;">Login</button>
</form></body></html>
`;

// --- 后端逻辑 ---

function calcDays(expDateStr) {
  if (!expDateStr) return 0;
  try {
      const exp = new Date(expDateStr);
      const now = new Date();
      const diffTime = exp - now;
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  } catch (e) { return 0; }
}

async function checkWebsite(url) {
  let target = url.startsWith('http') ? url : `http://${url}`;
  const start = Date.now();
  try {
      const resp = await fetch(target, {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (DomainMonitor-Worker)' },
          redirect: 'follow'
      });
      return { online: true, code: resp.status.toString(), ms: Date.now() - start };
  } catch (e) {
      return { online: false, code: "Error", ms: 0 };
  }
}

export default {
  // 1. HTTP 请求处理 (Web 访问)
  async fetch(request, env) {
      const url = new URL(request.url);
      const method = request.method;
      
      // 1. 获取密码 (从 Secrets 环境变量)
      const SYS_PASSWORD = env.PASSWORD || "123456"; 
      
      // 2. 鉴权
      const cookie = request.headers.get('Cookie') || "";
      const isLoggedIn = cookie.includes(`auth=${SYS_PASSWORD}`);

      // 登录路由
      if (url.pathname === '/login') {
          if (method === 'POST') {
              const fd = await request.formData();
              if (fd.get('password') === SYS_PASSWORD) {
                  return new Response('Redirecting...', {
                      status: 302,
                      headers: { 'Location': '/', 'Set-Cookie': `auth=${SYS_PASSWORD}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax` }
                  });
              }
          }
          return new Response(LOGIN_HTML, { headers: { 'Content-Type': 'text/html' } });
      }

      if (url.pathname === '/logout') {
          return new Response('Logged out', {
              status: 302,
              headers: { 'Location': '/login', 'Set-Cookie': 'auth=; Path=/; Max-Age=0' }
          });
      }

      if (!isLoggedIn) return new Response(null, { status: 302, headers: { 'Location': '/login' } });

      // 主页
      if (url.pathname === '/') {
          const { results: domains } = await env.DB.prepare("SELECT * FROM Domain ORDER BY position ASC").all();
          const config = await env.DB.prepare("SELECT * FROM Config LIMIT 1").first() || {};
          const stats = {
              total: domains.length,
              online: domains.filter(d => d.is_online).length,
              issue: domains.filter(d => !d.is_online && d.status_code !== 'N/A').length,
              soon: domains.filter(d => d.days_to_expire < 30).length
          };
          return new Response(renderHTML(domains, config, stats), { headers: { 'Content-Type': 'text/html' } });
      }

      // --- APIs ---

      // 添加
      if (url.pathname === '/api/add_bulk' && method === 'POST') {
          const fd = await request.formData();
          const lines = (fd.get('domains') || "").split('\n');
          const stmt = env.DB.prepare("INSERT OR IGNORE INTO Domain (domain_name, position) VALUES (?, 999)");
          const batch = [];
          for (let line of lines) {
              let clean = line.trim().replace(/^https?:\/\//, '').split('/')[0];
              if (clean && clean.includes('.')) batch.push(stmt.bind(clean));
          }
          if (batch.length) await env.DB.batch(batch);
          return Response.json({ status: 'success' });
      }

      // 删除
      if (url.pathname.startsWith('/api/delete/')) {
          const id = url.pathname.split('/').pop();
          await env.DB.prepare("DELETE FROM Domain WHERE id=?").bind(id).run();
          return Response.json({ status: 'success' });
      }

      // 编辑
      if (url.pathname === '/api/edit') {
          const fd = await request.formData();
          const days = calcDays(fd.get('exp_date'));
          await env.DB.prepare("UPDATE Domain SET domain_name=?, remark=?, registration_date=?, expiration_date=?, days_to_expire=? WHERE id=?")
              .bind(fd.get('domain_name'), fd.get('remark'), fd.get('reg_date'), fd.get('exp_date'), days, fd.get('id')).run();
          return Response.json({ status: 'success' });
      }

      // 刷新
      if (url.pathname.startsWith('/api/refresh/')) {
          const id = url.pathname.split('/').pop();
          const d = await env.DB.prepare("SELECT * FROM Domain WHERE id=?").bind(id).first();
          if(d) {
              const res = await checkWebsite(d.domain_name);
              const days = calcDays(d.expiration_date);
              await env.DB.prepare("UPDATE Domain SET is_online=?, status_code=?, response_time=?, last_checked=?, days_to_expire=? WHERE id=?")
                  .bind(res.online?1:0, res.code, res.ms, new Date().toISOString(), days, id).run();
              return Response.json({ status: 'success', ...res });
          }
          return Response.json({ status: 'error' });
      }

      // 保存配置
      if (url.pathname === '/api/save_config') {
          const fd = await request.formData();
          await env.DB.prepare("UPDATE Config SET gist_token=?, webdav_url=?, webdav_user=?, webdav_pass=? WHERE id=1")
              .bind(fd.get('gist_token'), fd.get('webdav_url'), fd.get('webdav_user'), fd.get('webdav_pass')).run();
          return Response.json({ status: 'success', msg: '配置已保存' });
      }

      // --- 备份/恢复逻辑 ---

      async function getBackupJson() {
          const { results } = await env.DB.prepare("SELECT domain_name as domain, registration_date as reg, expiration_date as exp, remark FROM Domain").all();
          return JSON.stringify(results, null, 2);
      }
      
      async function restoreData(data) {
          if (typeof data === 'string') data = JSON.parse(data);
          const stmt = env.DB.prepare("INSERT OR IGNORE INTO Domain (domain_name, remark, registration_date, expiration_date, position) VALUES (?, ?, ?, ?, 999)");
          const batch = [];
          for (let item of data) {
              if (item.domain) batch.push(stmt.bind(item.domain, item.remark||'', item.reg||'', item.exp||''));
          }
          if (batch.length) await env.DB.batch(batch);
      }

      // Gist Action
      if (url.pathname.startsWith('/api/gist/')) {
          const action = url.pathname.split('/').pop();
          const conf = await env.DB.prepare("SELECT * FROM Config LIMIT 1").first();
          if (!conf.gist_token) return Response.json({status:'error', msg:'无 Gist Token'});
          
          const headers = { 
              'Authorization': `token ${conf.gist_token}`, 
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'DomainMonitor-Worker'
          };

          if (action === 'export') {
              const content = await getBackupJson();
              const payload = { description: "Domain Monitor Backup", public: false, files: { "domains_backup.json": { content } } };
              let gId = conf.gist_id;
              
              if (gId) {
                  const r = await fetch(`https://api.github.com/gists/${gId}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
                  if (r.status !== 200) gId = null; 
              }
              
              if (!gId) {
                  const r = await fetch("https://api.github.com/gists", { method: 'POST', headers, body: JSON.stringify(payload) });
                  if (r.status === 201) {
                      const json = await r.json();
                      await env.DB.prepare("UPDATE Config SET gist_id=? WHERE id=1").bind(json.id).run();
                      return Response.json({status:'success', msg:'新 Gist 创建成功'});
                  }
                  return Response.json({status:'error', msg:'创建 Gist 失败'});
              }
              return Response.json({status:'success', msg:'Gist 更新成功'});
          }

          if (action === 'import') {
              if (!conf.gist_id) return Response.json({status:'error', msg:'未绑定 Gist ID'});
              const r = await fetch(`https://api.github.com/gists/${conf.gist_id}`, { headers });
              if (r.ok) {
                  const json = await r.json();
                  if (json.files['domains_backup.json']) {
                      await restoreData(json.files['domains_backup.json'].content);
                      return Response.json({status:'success', msg:'恢复成功'});
                  }
              }
              return Response.json({status:'error', msg:'读取 Gist 失败'});
          }
      }

      // WebDAV Action
      if (url.pathname.startsWith('/api/webdav/')) {
          const action = url.pathname.split('/').pop();
          const conf = await env.DB.prepare("SELECT * FROM Config LIMIT 1").first();
          if (!conf.webdav_url) return Response.json({status:'error', msg:'无 WebDAV 配置'});

          const targetUrl = conf.webdav_url.replace(/\/+$/, '') + '/domains_backup.json';
          const auth = btoa(`${conf.webdav_user}:${conf.webdav_pass}`);
          const headers = { 'Authorization': `Basic ${auth}` };

          if (action === 'export') {
              const content = await getBackupJson();
              const r = await fetch(targetUrl, { method: 'PUT', headers, body: content });
              if ([200, 201, 204].includes(r.status)) return Response.json({status:'success', msg:'WebDAV 上传成功'});
              return Response.json({status:'error', msg: `上传失败: ${r.status}`});
          }

          if (action === 'import') {
              const r = await fetch(targetUrl, { headers });
              if (r.ok) {
                  const json = await r.json();
                  await restoreData(json);
                  return Response.json({status:'success', msg:'恢复成功'});
              }
              return Response.json({status:'error', msg: `下载失败: ${r.status}`});
          }
      }

      return new Response('Not Found', { status: 404 });
  },

  // 2. Cron 触发器 (新增：处理后台定时任务)
  async scheduled(controller, env, ctx) {
      console.log("Cron triggered: Starting background checks...");
      
      const { results } = await env.DB.prepare("SELECT * FROM Domain").all();
      if (!results || results.length === 0) {
          console.log("No domains to check.");
          return;
      }

      // 并发执行所有检查任务，使用 Promise.all 提高速度
      const checkTasks = results.map(async (d) => {
          try {
              // 检测网站状态
              const res = await checkWebsite(d.domain_name);
              // 重新计算剩余天数
              const days = calcDays(d.expiration_date);
              
              // 更新数据库
              await env.DB.prepare(
                  "UPDATE Domain SET is_online=?, status_code=?, response_time=?, last_checked=?, days_to_expire=? WHERE id=?"
              ).bind(
                  res.online ? 1 : 0, 
                  res.code, 
                  res.ms, 
                  new Date().toISOString(), 
                  days, 
                  d.id
              ).run();
              
              console.log(`Updated ${d.domain_name}: ${res.code}`);
          } catch (err) {
              console.error(`Failed to check ${d.domain_name}:`, err);
          }
      });

      // 确保 Worker 在所有任务完成前不关闭
      ctx.waitUntil(Promise.all(checkTasks));
  }
};
