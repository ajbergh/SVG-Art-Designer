package model

import (
	"database/sql"
	"fmt"
	"strings"
)

// Design represents a saved SVG design in the database.
type Design struct {
	ID               int64  `json:"id"`
	Prompt           string `json:"prompt"`
	Style            string `json:"style"`
	Model            string `json:"model"`
	SVGContent       string `json:"svg_content"`
	LayersEnabled    bool   `json:"layers_enabled"`
	AnimationEnabled bool   `json:"animation_enabled"`
	CreatedAt        string `json:"created_at"`
}

// DesignList is a paginated list of designs.
type DesignList struct {
	Designs []Design `json:"designs"`
	Total   int      `json:"total"`
	Limit   int      `json:"limit"`
	Offset  int      `json:"offset"`
}

// DesignStore handles design persistence.
type DesignStore struct {
	db *sql.DB
}

// NewDesignStore creates a new DesignStore.
func NewDesignStore(db *sql.DB) *DesignStore {
	return &DesignStore{db: db}
}

// Create inserts a new design and returns its ID.
func (s *DesignStore) Create(d *Design) (int64, error) {
	result, err := s.db.Exec(
		`INSERT INTO designs (prompt, style, model, svg_content, layers_enabled, animation_enabled)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		d.Prompt, d.Style, d.Model, d.SVGContent, boolToInt(d.LayersEnabled), boolToInt(d.AnimationEnabled),
	)
	if err != nil {
		return 0, fmt.Errorf("insert design: %w", err)
	}
	return result.LastInsertId()
}

// GetByID retrieves a single design.
func (s *DesignStore) GetByID(id int64) (*Design, error) {
	var d Design
	var layers, animation int
	err := s.db.QueryRow(
		`SELECT id, prompt, style, model, svg_content, layers_enabled, animation_enabled, created_at
		 FROM designs WHERE id = ?`, id,
	).Scan(&d.ID, &d.Prompt, &d.Style, &d.Model, &d.SVGContent, &layers, &animation, &d.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get design %d: %w", id, err)
	}
	d.LayersEnabled = layers != 0
	d.AnimationEnabled = animation != 0
	return &d, nil
}

// List returns a paginated list of designs, newest first.
func (s *DesignStore) List(limit, offset int, style, query string) (*DesignList, error) {
	var conditions []string
	var args []interface{}

	if style != "" {
		conditions = append(conditions, "style = ?")
		args = append(args, style)
	}
	if query != "" {
		conditions = append(conditions, "prompt LIKE ?")
		args = append(args, "%"+query+"%")
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Get total count.
	var total int
	countSQL := "SELECT COUNT(*) FROM designs " + where
	if err := s.db.QueryRow(countSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count designs: %w", err)
	}

	// Get page.
	listSQL := fmt.Sprintf(
		"SELECT id, prompt, style, model, svg_content, layers_enabled, animation_enabled, created_at FROM designs %s ORDER BY created_at DESC LIMIT ? OFFSET ?",
		where,
	)
	pageArgs := append(args, limit, offset)
	rows, err := s.db.Query(listSQL, pageArgs...)
	if err != nil {
		return nil, fmt.Errorf("list designs: %w", err)
	}
	defer rows.Close()

	designs := make([]Design, 0)
	for rows.Next() {
		var d Design
		var layers, animation int
		if err := rows.Scan(&d.ID, &d.Prompt, &d.Style, &d.Model, &d.SVGContent, &layers, &animation, &d.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan design: %w", err)
		}
		d.LayersEnabled = layers != 0
		d.AnimationEnabled = animation != 0
		designs = append(designs, d)
	}

	return &DesignList{
		Designs: designs,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
	}, nil
}

// Delete removes a design by ID.
func (s *DesignStore) Delete(id int64) error {
	result, err := s.db.Exec("DELETE FROM designs WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete design %d: %w", id, err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteAll removes all designs.
func (s *DesignStore) DeleteAll() error {
	_, err := s.db.Exec("DELETE FROM designs")
	if err != nil {
		return fmt.Errorf("delete all designs: %w", err)
	}
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
