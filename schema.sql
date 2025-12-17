DROP TABLE IF EXISTS Domain;
DROP TABLE IF EXISTS Config;

CREATE TABLE Domain (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_name TEXT UNIQUE NOT NULL,
    registration_date TEXT DEFAULT "",
    expiration_date TEXT DEFAULT "",
    days_to_expire INTEGER DEFAULT 0,
    remark TEXT DEFAULT "",
    is_online BOOLEAN DEFAULT 0,
    status_code TEXT DEFAULT "N/A",
    response_time INTEGER DEFAULT 0,
    last_checked TEXT,
    position INTEGER DEFAULT 0
);

CREATE TABLE Config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gist_token TEXT DEFAULT "",
    gist_id TEXT DEFAULT "",
    webdav_url TEXT DEFAULT "",
    webdav_user TEXT DEFAULT "",
    webdav_pass TEXT DEFAULT ""
);

INSERT INTO Config (id) VALUES (1);
