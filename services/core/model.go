package core

import "time"

type User struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Resource struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Data      string    `json:"data"`
	OwnerID   int64     `json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateUserRequest struct {
	Email string `json:"email" binding:"required,email"`
	Name  string `json:"name"  binding:"required"`
}

type UpdateUserRequest struct {
	Name string `json:"name" binding:"required"`
}

type CreateResourceRequest struct {
	Name    string `json:"name"     binding:"required"`
	Data    string `json:"data"`
	OwnerID int64  `json:"owner_id" binding:"required"`
}
