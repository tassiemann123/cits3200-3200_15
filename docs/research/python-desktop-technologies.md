# Python Desktop Technologies Research



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

## 3D Visualisation Libraries

Selecting an appropriate 3D visualisation library is one of the most important technical decisions for this project. The library must support interactive rendering, camera controls, marker placement and future expansion while remaining compatible with Python desktop applications.

### PyVista

PyVista is a high-level Python library built on top of VTK. It provides a much simpler interface while retaining access to VTK's powerful rendering capabilities. PyVista is widely used in scientific visualisation, engineering and medical imaging applications.

Advantages:

- Easy to learn and use
- Built on the powerful VTK engine
- Supports interactive rotation, zooming and panning
- Excellent documentation
- Integrates well with PySide6
- Suitable for displaying 3D models and annotations

Disadvantages:

- Depends on VTK, increasing installation size
- Fewer advanced rendering options than directly using VTK

### VTK (Visualization Toolkit)

VTK is one of the most established open-source libraries for scientific 3D graphics and visualisation. It is widely used in medicine, archaeology, engineering and research applications.

Advantages:

- Extremely powerful rendering engine
- Supports complex 3D visualisation workflows
- Highly configurable
- Large academic and professional user base

Disadvantages:

- Steep learning curve
- Complex API
- Requires more development time

### Open3D

Open3D is an open-source library designed for processing 3D data such as point clouds and meshes. It provides useful tools for geometry processing and visualisation.

Advantages:

- Excellent support for point cloud processing
- Active open-source community
- Useful for future extensions involving scanned skeletal data

Disadvantages:

- Primarily designed for geometry processing rather than desktop applications
- Less suitable for building a complete interactive desktop interface

### Comparison

| Library | Ease of Use | 3D Rendering | Desktop Integration | Learning Curve |
|---------|-------------|--------------|--------------------|----------------|
| PyVista | High | Excellent | Excellent | Low |
| VTK | Medium | Excellent | Excellent | High |
| Open3D | Medium | Good | Moderate | Medium |

### Summary

PyVista appears to be the strongest option for this project. It combines the rendering capabilities of VTK with a significantly simpler programming interface. Since the project mainly requires displaying a human skeleton, navigating the scene and placing annotations, PyVista provides sufficient functionality while reducing implementation complexity. VTK remains an excellent foundation for future expansion if more advanced rendering features become necessary.


## CSV Data Handling

The project specification requires the application to import XYZ coordinate data from CSV files. Python provides excellent built-in support for reading and processing CSV data, making this requirement straightforward to implement.

### Python csv Module

Python includes the built-in `csv` module, which can efficiently read and write comma-separated value files without requiring additional dependencies.

Advantages:

- Included with Python by default
- Simple API
- Suitable for small and medium-sized datasets
- Easy to integrate with desktop applications

### pandas

The pandas library provides more advanced functionality for handling structured data. It simplifies validation, filtering and preprocessing of imported coordinate data.

Advantages:

- Powerful data manipulation
- Easy handling of missing or invalid values
- Supports multiple file formats
- Useful for future project expansion

Disadvantages:

- Larger dependency than the built-in csv module
- Additional learning required for team members unfamiliar with pandas

### Summary

For the current project, Python's built-in csv module is sufficient for importing skeletal coordinate files. If future versions require more advanced data analysis or validation, pandas can be introduced without major changes to the application architecture.

## Application Packaging

The completed application should be distributed as a standalone desktop program so that researchers can use it without installing Python manually.

### PyInstaller

PyInstaller converts Python applications into standalone executables for Windows, macOS and Linux by packaging the Python interpreter and all required dependencies.

Advantages:

- Cross-platform packaging
- No Python installation required for end users
- Widely adopted within the Python community
- Simple build process

Disadvantages:

- Large executable size
- Packaging complex graphical libraries may require additional configuration

### Summary

PyInstaller appears to be the most practical deployment solution for the project because it supports all target operating systems and requires minimal changes to the application code.

## Licensing Considerations

The project specification encourages the use of open-source software where possible. Licensing should therefore be considered when selecting development tools.

PySide6 is distributed under the LGPL licence, allowing flexible use in both academic and many commercial environments.

PyVista, VTK and Open3D are open-source projects with permissive licences suitable for research and education.

Selecting libraries with permissive licences reduces legal risk and simplifies future maintenance or extension of the software.

### Summary

The proposed technology stack is compatible with the project's open-source requirements and does not introduce significant licensing concerns.

## Recommendation

Based on the current project requirements, a combination of PySide6 and PyVista appears to provide the best balance between usability, functionality and development effort. PySide6 offers a modern desktop interface, while PyVista simplifies interactive 3D visualisation through its VTK-based architecture.

Python's built-in csv module is sufficient for importing coordinate data during the initial development stages, and PyInstaller provides a practical solution for distributing the completed application to researchers.

However, the final technology stack should be confirmed after further discussion with the development team and the client to ensure that it aligns with project requirements, team experience and the overall project timeline.

## References

Open3D Documentation. https://www.open3d.org/

PyInstaller Documentation. https://pyinstaller.org/

PySide6 Documentation. https://doc.qt.io/qtforpython/

PyVista Documentation. https://docs.pyvista.org/

Python csv Module Documentation. https://docs.python.org/3/library/csv.html

Visualization Toolkit (VTK). https://vtk.org/