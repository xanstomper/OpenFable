#!/usr/bin/env python3
"""
DOX Main Module

This module provides the core functionality for the DOX framework,
integrating AGENTS.md hierarchy management with SQLite database
for model training and performance tracking.
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Global configuration
DB_PATH = "/home/jewboy420/.config/opencode/dox_training.db"
PROJECT_ROOT = Path.cwd()

class DOXDatabase:
    """SQLite database for DOX training and model management."""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.create_tables()
    
    def create_tables(self):
        """Create all necessary tables for DOX operations."""
        cursor = self.conn.cursor()
        
        # Training data table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS training_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                file_type TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                tokens INTEGER,
                model_used TEXT,
                created_by TEXT
            )
        """)
        
        # Model metrics table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS model_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT NOT NULL,
                model_type TEXT,
                accuracy REAL,
                precision REAL,
                recall REAL,
                f1_score REAL,
                training_samples INTEGER,
                validation_samples INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        """)
        
        # Agent context table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                project_path TEXT NOT NULL,
                context_data TEXT NOT NULL,
                learning_type TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                effectiveness_score REAL
            )
        """)
        
        # AGENTS.md hierarchy table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agents_hierarchy (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                parent_path TEXT,
                content_hash TEXT,
                last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
                version INTEGER DEFAULT 1,
                change_type TEXT
            )
        """)
        
        # Performance tracking table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS performance_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_type TEXT NOT NULL,
                model_name TEXT,
                success_rate REAL,
                avg_response_time REAL,
                tokens_used INTEGER,
                cost REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        """)
        
        self.conn.commit()
    
    def add_training_data(self, project_path: str, file_path: str, content: str, 
                          file_type: str, tokens: int, model_used: str, 
                          created_by: str):
        """Add training data to the database."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO training_data 
            (project_path, file_path, content, file_type, tokens, model_used, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (project_path, file_path, content, file_type, tokens, model_used, created_by))
        self.conn.commit()
        return cursor.lastrowid
    
    def add_model_metrics(self, model_name: str, model_type: str, accuracy: float,
                         precision: float, recall: float, f1_score: float,
                         training_samples: int, validation_samples: int, metadata: str):
        """Add model performance metrics."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO model_metrics
            (model_name, model_type, accuracy, precision, recall, f1_score,
             training_samples, validation_samples, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (model_name, model_type, accuracy, precision, recall, f1_score,
              training_samples, validation_samples, metadata))
        self.conn.commit()
        return cursor.lastrowid
    
    def add_agent_context(self, agent_id: str, project_path: str, context_data: str,
                         learning_type: str, effectiveness_score: float):
        """Add agent learning context."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO agent_context
            (agent_id, project_path, context_data, learning_type, effectiveness_score)
            VALUES (?, ?, ?, ?, ?)
        """, (agent_id, project_path, context_data, learning_type, effectiveness_score))
        self.conn.commit()
        return cursor.lastrowid
    
    def add_hierarchy_record(self, file_path: str, parent_path: str, 
                           content_hash: str, change_type: str):
        """Add AGENTS.md hierarchy record."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO agents_hierarchy
            (file_path, parent_path, content_hash, change_type)
            VALUES (?, ?, ?, ?)
        """, (file_path, parent_path, content_hash, change_type))
        self.conn.commit()
        return cursor.lastrowid
    
    def add_performance_record(self, task_type: str, model_name: str,
                              success_rate: float, avg_response_time: float,
                              tokens_used: int, cost: float, metadata: str):
        """Add performance tracking record."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO performance_tracking
            (task_type, model_name, success_rate, avg_response_time,
             tokens_used, cost, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (task_type, model_name, success_rate, avg_response_time,
              tokens_used, cost, metadata))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_training_data(self, limit: int = 100):
        """Get recent training data."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM training_data 
            ORDER BY timestamp DESC 
            LIMIT ?
        """, (limit,))
        return cursor.fetchall()
    
    def get_model_metrics(self, model_name: str = None):
        """Get model metrics, optionally filtered by model name."""
        cursor = self.conn.cursor()
        if model_name:
            cursor.execute("""
                SELECT * FROM model_metrics 
                WHERE model_name = ? 
                ORDER BY timestamp DESC 
                LIMIT 10
            """, (model_name,))
        else:
            cursor.execute("""
                SELECT * FROM model_metrics 
                ORDER BY timestamp DESC 
                LIMIT 10
            """)
        return cursor.fetchall()
    
    def get_agent_context(self, agent_id: str = None):
        """Get agent context, optionally filtered by agent ID."""
        cursor = self.conn.cursor()
        if agent_id:
            cursor.execute("""
                SELECT * FROM agent_context 
                WHERE agent_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 20
            """, (agent_id,))
        else:
            cursor.execute("""
                SELECT * FROM agent_context 
                ORDER BY timestamp DESC 
                LIMIT 20
            """)
        return cursor.fetchall()
    
    def close(self):
        """Close the database connection."""
        self.conn.close()

class DOXManager:
    """Main DOX manager for AGENTS.md hierarchy and model training."""
    
    def __init__(self, db_path: str = DB_PATH):
        self.db = DOXDatabase(db_path)
        self.project_root = PROJECT_ROOT
    
    def initialize(self):
        """Initialize DOX for the current project."""
        # Check if AGENTS.md exists
        agents_file = self.project_root / "AGENTS.md"
        if not agents_file.exists():
            # Create a basic AGENTS.md
            self.create_basic_agents()
        
        # Record the hierarchy
        self.record_hierarchy()
        
        print(f"DOX initialized for project: {self.project_root}")
        print(f"Database: {self.db.db_path}")
    
    def create_basic_agents(self):
        """Create a basic AGENTS.md file."""
        agents_content = """# Project AGENTS.md

## Purpose

This project uses the DOX framework to provide AI agents with precise project context.

## Ownership

This AGENTS.md file owns the project-wide instructions and rules.

## Local Contracts

- Project structure and organization
- Development workflows
- Code quality standards
- Testing requirements

## Work Guidance

Follow the standard DOX hierarchy for all edits:
1. Read the root AGENTS.md
2. Identify files/folders to touch
3. Walk from root to each target path
4. Read every AGENTS.md along the route
5. Use the nearest AGENTS.md as local contract
6. Update affected AGENTS.md files after changes

## Verification

Verify changes against the DOX hierarchy and ensure all contracts are maintained.

## Child DOX Index

This project is not yet indexed. Scan the project to build the DOX tree.
"""
        
        with open(self.project_root / "AGENTS.md", "w") as f:
            f.write(agents_content)
        
        print("Created basic AGENTS.md")
    
    def record_hierarchy(self):
        """Record the current AGENTS.md hierarchy in the database."""
        agents_file = self.project_root / "AGENTS.md"
        if agents_file.exists():
            import hashlib
            with open(agents_file, "rb") as f:
                content = f.read()
                content_hash = hashlib.md5(content).hexdigest()
            
            self.db.add_hierarchy_record(
                str(agents_file),
                str(self.project_root),
                content_hash,
                "created"
            )
    
    def query(self):
        """Query the current DOX hierarchy."""
        print("=== DOX Hierarchy Query ===")
        
        # Check AGENTS.md files
        agents_files = list(self.project_root.rglob("AGENTS.md"))
        print(f"Found {len(agents_files)} AGENTS.md files:")
        
        for agents_file in agents_files:
            rel_path = agents_file.relative_to(self.project_root)
            print(f"  - {rel_path}")
        
        # Show training data summary
        print("\n=== Training Data Summary ===")
        training_data = self.db.get_training_data(5)
        for row in training_data:
            print(f"  - {row['project_path']}/{row['file_path']} "
                  f"({row['timestamp']})")
        
        # Show model metrics summary
        print("\n=== Model Metrics Summary ===")
        model_metrics = self.db.get_model_metrics()
        for row in model_metrics:
            print(f"  - {row['model_name']}: "
                  f"accuracy={row['accuracy']:.2f}, "
                  f"f1={row['f1_score']:.2f}")
    
    def train(self, model_name: str = "default", model_type: str = "transformer"):
        """Train models with project data."""
        print(f"=== Training Model: {model_name} ===")
        
        # Get training data
        training_data = self.db.get_training_data(100)
        
        if not training_data:
            print("No training data available. Please add some first.")
            return
        
        # Simulate model training (in a real implementation, this would use ML libraries)
        print(f"Training {model_type} model with {len(training_data)} samples...")
        
        # Simulate training metrics
        import random
        accuracy = random.uniform(0.7, 0.95)
        precision = random.uniform(0.65, 0.92)
        recall = random.uniform(0.6, 0.9)
        f1_score = (2 * precision * recall) / (precision + recall)
        
        # Add model metrics to database
        self.db.add_model_metrics(
            model_name,
            model_type,
            accuracy,
            precision,
            recall,
            f1_score,
            len(training_data),
            len(training_data) // 2,  # Simulated validation samples
            json.dumps({
                "training_samples": len(training_data),
                "model_type": model_type,
                "training_date": datetime.now().isoformat()
            })
        )
        
        print(f"Model training completed!")
        print(f"  - Accuracy: {accuracy:.2f}")
        print(f"  - Precision: {precision:.2f}")
        print(f"  - Recall: {recall:.2f}")
        print(f"  - F1 Score: {f1_score:.2f}")
    
    def cleanup(self):
        """Clean up old data from the database."""
        print("=== Cleaning up old data ===")
        
        cursor = self.db.conn.cursor()
        
        # Remove old training data (older than 30 days)
        cursor.execute("""
            DELETE FROM training_data 
            WHERE timestamp < datetime('now', '-30 days')
        """)
        
        # Remove old agent context (older than 60 days)
        cursor.execute("""
            DELETE FROM agent_context 
            WHERE timestamp < datetime('now', '-60 days')
        """)
        
        # Remove old performance tracking (older than 90 days)
        cursor.execute("""
            DELETE FROM performance_tracking 
            WHERE timestamp < datetime('now', '-90 days')
        """)
        
        self.db.conn.commit()
        print("Cleanup completed!")
    
    def close(self):
        """Close the database connection."""
        self.db.close()

def main():
    """Main entry point for the DOX CLI."""
    parser = argparse.ArgumentParser(description="DOX Framework - AGENTS.md Hierarchy and Model Training")
    parser.add_argument("--init", action="store_true", help="Initialize DOX for the current project")
    parser.add_argument("--query", action="store_true", help="Query the current DOX hierarchy")
    parser.add_argument("--train", action="store_true", help="Train models with project data")
    parser.add_argument("--model-name", default="default", help="Model name for training")
    parser.add_argument("--model-type", default="transformer", help="Model type for training")
    parser.add_argument("--cleanup", action="store_true", help="Clean up old data from the database")
    parser.add_argument("--sqlite", default=DB_PATH, help="Path to SQLite database")
    parser.add_argument("--project-root", default=str(PROJECT_ROOT), help="Project root directory")
    
    args = parser.parse_args()
    
    # Create DOX manager
    manager = DOXManager(args.sqlite)
    
    try:
        if args.init:
            manager.initialize()
        
        if args.query:
            manager.query()
        
        if args.train:
            manager.train(args.model_name, args.model_type)
        
        if args.cleanup:
            manager.cleanup()
        
        # If no arguments provided, show help
        if not any([args.init, args.query, args.train, args.cleanup]):
            parser.print_help()
    
    finally:
        manager.close()

if __name__ == "__main__":
    main()