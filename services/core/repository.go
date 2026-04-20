package core

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(ctx context.Context, email, name string) (*User, error) {
	u := &User{Email: email, Name: name, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	err := r.db.QueryRow(ctx,
		`INSERT INTO users (email, name, created_at, updated_at)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		email, name, u.CreatedAt, u.UpdatedAt,
	).Scan(&u.ID)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}
	return u, nil
}

func (r *Repository) GetUser(ctx context.Context, id int64) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(ctx,
		`SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get user %d: %w", id, err)
	}
	return u, nil
}

func (r *Repository) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, email, name, created_at, updated_at FROM users ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *Repository) UpdateUser(ctx context.Context, id int64, name string) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(ctx,
		`UPDATE users SET name = $1, updated_at = $2 WHERE id = $3
		 RETURNING id, email, name, created_at, updated_at`,
		name, time.Now(), id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update user %d: %w", id, err)
	}
	return u, nil
}

func (r *Repository) DeleteUser(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func (r *Repository) CreateResource(ctx context.Context, name, data string, ownerID int64) (*Resource, error) {
	res := &Resource{Name: name, Data: data, OwnerID: ownerID, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	err := r.db.QueryRow(ctx,
		`INSERT INTO resources (name, data, owner_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		name, data, ownerID, res.CreatedAt, res.UpdatedAt,
	).Scan(&res.ID)
	if err != nil {
		return nil, fmt.Errorf("insert resource: %w", err)
	}
	return res, nil
}

func (r *Repository) GetResource(ctx context.Context, id int64) (*Resource, error) {
	res := &Resource{}
	err := r.db.QueryRow(ctx,
		`SELECT id, name, data, owner_id, created_at, updated_at FROM resources WHERE id = $1`, id,
	).Scan(&res.ID, &res.Name, &res.Data, &res.OwnerID, &res.CreatedAt, &res.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get resource %d: %w", id, err)
	}
	return res, nil
}

func (r *Repository) ListResources(ctx context.Context) ([]Resource, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, name, data, owner_id, created_at, updated_at FROM resources ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("list resources: %w", err)
	}
	defer rows.Close()

	var resources []Resource
	for rows.Next() {
		var res Resource
		if err := rows.Scan(&res.ID, &res.Name, &res.Data, &res.OwnerID, &res.CreatedAt, &res.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan resource: %w", err)
		}
		resources = append(resources, res)
	}
	return resources, rows.Err()
}

func (r *Repository) DeleteResource(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM resources WHERE id = $1`, id)
	return err
}
