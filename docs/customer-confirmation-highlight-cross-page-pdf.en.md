<style>
@page {
  size: A4 landscape;
  margin: 12mm;
}

body {
  color: #202124;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 9pt;
  line-height: 1.4;
}

h1 {
  font-size: 13pt;
  margin: 0 0 14pt;
}

h2 {
  font-size: 10.5pt;
  margin: 14pt 0 7pt;
  page-break-after: avoid;
}

p,
ul,
ol,
blockquote {
  margin: 5pt 0;
}

img {
  display: block;
  max-height: 145mm;
  max-width: 100%;
  object-fit: contain;
  page-break-inside: avoid;
}
</style>

# Confirmation of P&ID Highlighting, Cross-Page Highlighting, and PDF Export Requirements

## 1. Highlight Style in PDF

The highlight color, opacity, and line width for valves and flow paths can be configured in the system. The configured highlight style will also be used when exporting the PDF.

Please help us confirm whether the PDF highlighting shown in the following example is acceptable?

![Example of highlighting in PDF](./HighlightonPDF.png)

## 2. PDF Background Color

Which background style should be used for the exported PDF?

- Retain the original colors of the P&ID drawing; or
- Convert the P&ID background to black-and-gray or grayscale while retaining only the configured highlight color for improved contrast? The example below uses the black-and-gray background style.

![Example of cross-page highlighting](./CrossHighlight.png)

## 3. Cross-Page Highlighting Scenario

We prepared a reference example in which one P&ID DWG contains two zones, Zone 1 and Zone 2. The flow path continues from one zone to the other through a unique connection tag and remains highlighted in both zones.

1. Please help us confirm whether this scenario matches the intended definition of cross-page highlighting?
2. When a phase spans both zones, should the export produce one multi-page PDF containing both pages, or two separate single-page PDF files?

## 4. Browsing Steps for a Vessel Skid in an Integrated P&ID

Regarding the following requirement:

> User should be able to browse any step of any cycle dedicated to a specific vessel skid based on step selection drop-down option in case of integrated P&ID.

Our current understanding is that: in an integrated P&ID, a user can browse the cycles and steps associated with a specific vessel skid and select a step from a drop-down list. After the selection, the system displays or highlights the equipment and flow path associated with that step on the P&ID. 
1. Please help confirm if our  understanding of requirement is right?

To better understand the relationships among vessel skid, cycle, step, and the existing phase data, and to ensure that the expected interaction is implemented correctly, please help confirm the following:

1. How should the specific vessel skid be determined: should the user select it from a separate drop-down list, or should it be determined automatically from the currently opened integrated P&ID?
2.  What data defines the relationships between a vessel skid and its cycles and steps? Is this mapping provided by an existing configuration file or by P&ID tag information?
3.  Is the term "step" equivalent to "phase" in the current system? If not, please clarify the difference and relationship between a step and a phase.
4.  Should the drop-down list directly display all cycles and steps associated with the selected skid, or should the user first select a cycle and then select a step in a two-level selection process?
