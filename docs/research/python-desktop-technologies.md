# Python Desktop Technologies Research
# Includes:

## Purpose

## Project Requirements

## Desktop GUI Frameworks

### PySide6

### PyQt6

### Tkinter

## 3D Visualisation Libraries

### PyVista

### VTK

### Open3D

## CSV Data Handling

## Application Packaging

## Licensing Considerations

## Recommendation



## Purpose

This document investigates suitable Python technologies for developing the 3D Skeletal Annotation desktop application.

The research focuses on:

- Desktop GUI frameworks
- 3D visualisation libraries
- CSV handling for XYZ coordinate input
- Standalone application packaging
- Licensing and open-source suitability

## Project Requirements

The application should:

- Run as a standalone desktop application
- Provide a simple sidebar user interface
- Accept XYZ coordinate input manually or through CSV files
- Display a detailed 3D human skeleton model
- Support rotation, panning and zooming
- Allow markers or skeletal joints to be positioned using coordinates
- Save reconstructions locally
- Export screenshots or 3D views
- Avoid ongoing licensing fees

## Desktop GUI Frameworks

Several Python GUI frameworks were investigated to determine their suitability for developing the desktop application required for the project.

### PySide6

PySide6 is the official Qt for Python framework maintained by The Qt Company. It provides a comprehensive set of modern user interface components and supports Windows, macOS and Linux. PySide6 integrates well with OpenGL-based rendering and is commonly used for professional desktop software.

Advantages:

- Modern and responsive user interface
- Cross-platform support
- Strong documentation and active community
- Good integration with 3D visualisation libraries
- LGPL licence suitable for academic projects

Disadvantages:

- Larger application size
- More complex than basic GUI frameworks
- Requires additional learning compared with Tkinter

### PyQt6

PyQt6 provides functionality very similar to PySide6 because both are based on the Qt framework. It is mature, stable and widely adopted within the Python community.

Advantages:

- Rich collection of widgets
- Excellent documentation
- Reliable performance

Disadvantages:

- GPL or commercial licensing may restrict future commercial distribution
- Similar learning curve to PySide6

### Tkinter

Tkinter is included with the Python standard library and is easy to use for simple desktop applications. However, its appearance is dated and it provides limited support for modern user interface design.

Advantages:

- Included with Python
- Easy to learn
- Suitable for small utilities

Disadvantages:

- Outdated interface
- Limited support for advanced desktop applications
- Less suitable for integrating complex 3D visualisation

### Summary

PySide6 appears to be the strongest candidate for this project because it provides a modern user interface, cross-platform compatibility and good integration with scientific visualisation libraries. Although PyQt6 offers similar functionality, PySide6 has a more flexible licence that is generally preferable for university projects.