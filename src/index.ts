import express from "express";
import path from "path";
import layouts from "express-ejs-layouts";
import docRoutes from "./routes/docRoutes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.set("views", path.join(process.cwd(), "views"));
app.set("view engine", "ejs");
app.use(layouts);

app.use("/public", express.static(path.join(process.cwd(), "public")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/", docRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
