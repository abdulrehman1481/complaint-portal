"""
AHP Complaint Prioritization System - Interactive Dashboard
A user-friendly GUI for running the system without command-line
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import subprocess
import threading
import webbrowser
import os
from pathlib import Path
import sys


class AHPDashboard:
    def __init__(self, root):
        self.root = root
        self.root.title("AHP Complaint Prioritization System - Dashboard")
        self.root.geometry("900x700")
        self.root.configure(bg='#f0f0f0')
        
        # Set icon if available
        try:
            self.root.iconbitmap('icon.ico')
        except:
            pass
        
        self.process = None
        self.setup_ui()
        
    def setup_ui(self):
        """Create the user interface."""
        
        # Header
        header_frame = tk.Frame(self.root, bg='#2c3e50', height=80)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        header_frame.pack_propagate(False)
        
        title = tk.Label(
            header_frame,
            text="🗺️ AHP Complaint Prioritization System",
            font=('Arial', 20, 'bold'),
            bg='#2c3e50',
            fg='white'
        )
        title.pack(pady=20)
        
        subtitle = tk.Label(
            header_frame,
            text="Islamabad Complaint Management Dashboard",
            font=('Arial', 11),
            bg='#2c3e50',
            fg='#ecf0f1'
        )
        subtitle.pack()
        
        # Main container
        main_frame = tk.Frame(self.root, bg='#f0f0f0')
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        # Left panel - Actions
        left_panel = tk.Frame(main_frame, bg='white', relief=tk.RAISED, borderwidth=2)
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        action_label = tk.Label(
            left_panel,
            text="⚡ Quick Actions",
            font=('Arial', 14, 'bold'),
            bg='white',
            fg='#2c3e50'
        )
        action_label.pack(pady=15)
        
        # Action buttons
        button_config = {
            'font': ('Arial', 11),
            'width': 35,
            'height': 2,
            'relief': tk.RAISED,
            'borderwidth': 2,
            'cursor': 'hand2'
        }
        
        # Button 1: Full Analysis
        btn1 = tk.Button(
            left_panel,
            text="📊 Run Complete Analysis\n(Charts + Map + Report)",
            command=self.run_full_analysis,
            bg='#27ae60',
            fg='white',
            activebackground='#229954',
            **button_config
        )
        btn1.pack(pady=10, padx=20)
        
        # Button 2: Quick Prioritization
        btn2 = tk.Button(
            left_panel,
            text="⚡ Quick Prioritization Only\n(No Visualizations)",
            command=self.run_quick_prioritization,
            bg='#3498db',
            fg='white',
            activebackground='#2980b9',
            **button_config
        )
        btn2.pack(pady=10, padx=20)
        
        # Button 3: Generate Map Only
        btn3 = tk.Button(
            left_panel,
            text="🗺️ Generate Interactive Map Only",
            command=self.run_map_only,
            bg='#e67e22',
            fg='white',
            activebackground='#d35400',
            **button_config
        )
        btn3.pack(pady=10, padx=20)
        
        # Button 4: Generate Charts Only
        btn4 = tk.Button(
            left_panel,
            text="📈 Generate Charts Only\n(No Map)",
            command=self.run_charts_only,
            bg='#9b59b6',
            fg='white',
            activebackground='#8e44ad',
            **button_config
        )
        btn4.pack(pady=10, padx=20)
        
        # Separator
        separator = ttk.Separator(left_panel, orient='horizontal')
        separator.pack(fill=tk.X, pady=15, padx=20)
        
        # View buttons
        view_label = tk.Label(
            left_panel,
            text="👁️ View Results",
            font=('Arial', 12, 'bold'),
            bg='white',
            fg='#2c3e50'
        )
        view_label.pack(pady=10)
        
        view_button_config = button_config.copy()
        view_button_config['height'] = 1
        
        btn5 = tk.Button(
            left_panel,
            text="🗺️ Open Interactive Map",
            command=self.open_map,
            bg='#16a085',
            fg='white',
            activebackground='#138d75',
            **view_button_config
        )
        btn5.pack(pady=5, padx=20)
        
        btn6 = tk.Button(
            left_panel,
            text="📁 Open Reports Folder",
            command=self.open_reports,
            bg='#34495e',
            fg='white',
            activebackground='#2c3e50',
            **view_button_config
        )
        btn6.pack(pady=5, padx=20)
        
        btn7 = tk.Button(
            left_panel,
            text="📄 View CSV Results",
            command=self.open_csv,
            bg='#7f8c8d',
            fg='white',
            activebackground='#636e72',
            **view_button_config
        )
        btn7.pack(pady=5, padx=20)
        
        # Right panel - Output console
        right_panel = tk.Frame(main_frame, bg='white', relief=tk.RAISED, borderwidth=2)
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        console_label = tk.Label(
            right_panel,
            text="📟 System Output",
            font=('Arial', 14, 'bold'),
            bg='white',
            fg='#2c3e50'
        )
        console_label.pack(pady=15)
        
        # Output text area
        self.output_text = scrolledtext.ScrolledText(
            right_panel,
            wrap=tk.WORD,
            width=50,
            height=25,
            font=('Consolas', 9),
            bg='#2c3e50',
            fg='#ecf0f1',
            insertbackground='white'
        )
        self.output_text.pack(pady=10, padx=15, fill=tk.BOTH, expand=True)
        
        # Control buttons
        control_frame = tk.Frame(right_panel, bg='white')
        control_frame.pack(pady=10)
        
        clear_btn = tk.Button(
            control_frame,
            text="🗑️ Clear Output",
            command=self.clear_output,
            bg='#e74c3c',
            fg='white',
            font=('Arial', 9),
            cursor='hand2'
        )
        clear_btn.pack(side=tk.LEFT, padx=5)
        
        # Status bar
        self.status_bar = tk.Label(
            self.root,
            text="Ready | 80 Complaints | 5 Criteria | Islamabad Coverage",
            font=('Arial', 9),
            bg='#34495e',
            fg='white',
            anchor=tk.W,
            relief=tk.SUNKEN
        )
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Welcome message
        self.log_output("=" * 70)
        self.log_output("🎉 Welcome to AHP Complaint Prioritization Dashboard!")
        self.log_output("=" * 70)
        self.log_output("\n✨ Select an action from the left panel to get started.\n")
        self.log_output("📊 System Ready:")
        self.log_output("   • 80 Islamabad complaints with coordinates")
        self.log_output("   • AHP-based prioritization algorithm")
        self.log_output("   • Interactive map visualization")
        self.log_output("   • Comprehensive charts and reports\n")
        self.log_output("=" * 70 + "\n")
    
    def log_output(self, message):
        """Add message to output console."""
        self.output_text.insert(tk.END, message + "\n")
        self.output_text.see(tk.END)
        self.root.update()
    
    def clear_output(self):
        """Clear the output console."""
        self.output_text.delete(1.0, tk.END)
        self.log_output("Output cleared.\n")
    
    def run_command(self, cmd, description):
        """Run a command in a separate thread."""
        def execute():
            self.log_output(f"\n{'=' * 70}")
            self.log_output(f"▶️  Starting: {description}")
            self.log_output(f"{'=' * 70}\n")
            self.status_bar.config(text=f"Running: {description}...", bg='#e67e22')
            
            try:
                # Run command
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    shell=True
                )
                
                # Stream output
                for line in process.stdout:
                    self.log_output(line.rstrip())
                
                process.wait()
                
                if process.returncode == 0:
                    self.log_output(f"\n✅ Success: {description} completed!")
                    self.status_bar.config(text=f"✅ Completed: {description}", bg='#27ae60')
                    messagebox.showinfo("Success", f"{description} completed successfully!")
                else:
                    self.log_output(f"\n❌ Error: Command failed with code {process.returncode}")
                    self.status_bar.config(text=f"❌ Failed: {description}", bg='#e74c3c')
                    messagebox.showerror("Error", f"{description} failed!")
                    
            except Exception as e:
                self.log_output(f"\n❌ Error: {str(e)}")
                self.status_bar.config(text=f"❌ Error: {description}", bg='#e74c3c')
                messagebox.showerror("Error", f"An error occurred: {str(e)}")
            
            self.log_output(f"\n{'=' * 70}\n")
        
        # Run in thread to prevent UI freezing
        thread = threading.Thread(target=execute, daemon=True)
        thread.start()
    
    def run_full_analysis(self):
        """Run complete analysis with all visualizations."""
        cmd = "python main.py --visualize --map"
        self.run_command(cmd, "Complete Analysis (Charts + Map + Report)")
    
    def run_quick_prioritization(self):
        """Run prioritization without visualizations."""
        cmd = "python main.py"
        self.run_command(cmd, "Quick Prioritization")
    
    def run_map_only(self):
        """Generate interactive map only."""
        cmd = "python main.py --map"
        self.run_command(cmd, "Interactive Map Generation")
    
    def run_charts_only(self):
        """Generate charts without map."""
        cmd = "python main.py --visualize"
        self.run_command(cmd, "Chart Visualizations")
    
    def open_map(self):
        """Open the interactive map in browser."""
        map_path = Path('reports/charts/priority_map.html')
        if map_path.exists():
            self.log_output("\n🗺️  Opening interactive map in browser...")
            webbrowser.open(map_path.resolve().as_uri())
            self.log_output("✅ Map opened successfully!\n")
        else:
            self.log_output("\n❌ Map not found! Please generate it first.\n")
            messagebox.showwarning(
                "Map Not Found",
                "The interactive map hasn't been generated yet.\n\n"
                "Click 'Generate Interactive Map Only' or 'Run Complete Analysis' first."
            )
    
    def open_reports(self):
        """Open the reports folder."""
        reports_path = Path('reports/charts')
        if reports_path.exists():
            self.log_output("\n📁 Opening reports folder...")
            os.startfile(reports_path)
            self.log_output("✅ Folder opened successfully!\n")
        else:
            reports_path.mkdir(parents=True, exist_ok=True)
            self.log_output("\n📁 Created reports folder.\n")
            os.startfile(reports_path)
    
    def open_csv(self):
        """Open the prioritized results CSV."""
        csv_path = Path('data/prioritized_results.csv')
        if csv_path.exists():
            self.log_output("\n📄 Opening CSV results...")
            os.startfile(csv_path)
            self.log_output("✅ CSV opened successfully!\n")
        else:
            self.log_output("\n❌ Results CSV not found! Please run analysis first.\n")
            messagebox.showwarning(
                "CSV Not Found",
                "The results CSV hasn't been generated yet.\n\n"
                "Run any prioritization option first."
            )


def main():
    """Launch the dashboard."""
    root = tk.Tk()
    app = AHPDashboard(root)
    root.mainloop()


if __name__ == "__main__":
    main()
