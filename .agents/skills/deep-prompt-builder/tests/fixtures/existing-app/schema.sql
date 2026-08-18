CREATE TABLE saved_items (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL
);

CREATE TABLE shared_item_access (
    item_id INTEGER NOT NULL,
    viewer_id INTEGER NOT NULL,
    PRIMARY KEY (item_id, viewer_id)
);
